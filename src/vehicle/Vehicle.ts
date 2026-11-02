import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { PhysicsWorld } from '../physics/World';
import type { Heightmap } from '../terrain/Heightmap';
import type { InputState } from '../core/Input';
import { TROOPER, type DriveMode } from './TrooperSpec';
import { Drivetrain } from './Drivetrain';
import { buildTrooperVisual, type VehicleVisual } from './TrooperBody';

export interface WheelState {
  contact: boolean;
  slip: number;      // 0..1 longitudinal slip estimate
  sand: number;      // surface sandiness under the wheel
  compression: number;
  dig: number;       // 0..1 how deep the wheel has dug into sand
}

export interface VehicleTelemetry {
  speedKmh: number;
  forwardSpeed: number;
  rpm: number;
  gear: number;
  mode: DriveMode;
  pitchDeg: number;
  rollDeg: number;
  upright: boolean;
  airborne: boolean;
  wheels: WheelState[];
  throttle: number;
  brake: number;
  steer: number;
  wheelSpin: number; // 0..1 driven wheels spinning without traction
}

const MODES: DriveMode[] = ['2H', '4H', '4L'];

/** The Trooper: Rapier raycast vehicle + drivetrain + visual sync. */
export class Vehicle {
  readonly body: RAPIER.RigidBody;
  readonly controller: RAPIER.DynamicRayCastVehicleController;
  readonly visual: VehicleVisual;
  readonly drivetrain = new Drivetrain();
  readonly telemetry: VehicleTelemetry;
  readonly position = new THREE.Vector3();
  readonly quaternion = new THREE.Quaternion();
  readonly forward = new THREE.Vector3(0, 0, 1);
  readonly up = new THREE.Vector3(0, 1, 0);
  readonly velocity = new THREE.Vector3();
  private flippedFor = 0;
  private modeMessage: ((key: string) => void) | null = null;
  private steerAngle = 0;
  private readonly wheelLocal: THREE.Vector3[] = [];
  private spinEstimate = 0;

  constructor(physics: PhysicsWorld, private hm: Heightmap, scene: THREE.Scene, spawn: THREE.Vector3, headingRad = 0) {
    const { R, world } = physics;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), headingRad);
    this.body = world.createRigidBody(
      R.RigidBodyDesc.dynamic().setTranslation(spawn.x, spawn.y, spawn.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setLinearDamping(0.05).setAngularDamping(0.6).setCcdEnabled(true),
    );
    const b = TROOPER.bodyHalf, l = TROOPER.lowMassHalf;
    world.createCollider(R.ColliderDesc.cuboid(b.x, b.y, b.z).setTranslation(0, 0.12, 0).setMass(TROOPER.massKg * (1 - TROOPER.lowMassFraction)).setFriction(0.6), this.body);
    world.createCollider(R.ColliderDesc.cuboid(l.x, l.y, l.z).setTranslation(0, TROOPER.lowMassY, 0).setMass(TROOPER.massKg * TROOPER.lowMassFraction).setFriction(0.6), this.body);

    this.controller = world.createVehicleController(this.body);
    this.controller.indexUpAxis = 1;
    this.controller.setIndexForwardAxis = 2;
    const s = TROOPER.suspension;
    const hx = TROOPER.track / 2, hz = TROOPER.wheelbase / 2;
    const pts = [[-hx, hz], [hx, hz], [-hx, -hz], [hx, -hz]]; // FL, FR, RL, RR (local +z forward)
    for (const [x, z] of pts) {
      this.wheelLocal.push(new THREE.Vector3(x, TROOPER.wheelY, z));
      this.controller.addWheel({ x, y: TROOPER.wheelY, z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, s.restLength, TROOPER.wheelRadius);
    }
    for (let i = 0; i < 4; i++) {
      this.controller.setWheelSuspensionStiffness(i, s.stiffness);
      this.controller.setWheelSuspensionCompression(i, s.compression);
      this.controller.setWheelSuspensionRelaxation(i, s.relaxation);
      this.controller.setWheelMaxSuspensionForce(i, s.maxForce);
      this.controller.setWheelMaxSuspensionTravel(i, s.maxTravel);
      this.controller.setWheelFrictionSlip(i, TROOPER.grip.gravel);
      this.controller.setWheelSideFrictionStiffness(i, 0.85);
    }

    this.visual = buildTrooperVisual();
    scene.add(this.visual.root);
    this.telemetry = {
      speedKmh: 0, forwardSpeed: 0, rpm: 0, gear: 1, mode: '4H', pitchDeg: 0, rollDeg: 0, upright: true, airborne: false,
      wheels: Array.from({ length: 4 }, () => ({ contact: false, slip: 0, sand: 0, compression: 0, dig: 0 })), throttle: 0, brake: 0, steer: 0, wheelSpin: 0,
    };
    this.syncVisual();
  }

  get mode(): DriveMode { return this.drivetrain.state.mode; }

  onMessage(fn: (key: string) => void): void { this.modeMessage = fn; }

  /** Cycle drive mode; 4L engagement needs a near standstill like the real transfer case. */
  cycleMode(dir: 1 | -1): void {
    const i = MODES.indexOf(this.mode);
    const next = MODES[(i + dir + MODES.length) % MODES.length];
    if ((next === '4L' || this.mode === '4L') && Math.abs(this.telemetry.forwardSpeed) > 3.5) { this.modeMessage?.('msg.stopFor4L'); return; }
    this.drivetrain.setMode(next);
    this.modeMessage?.(`msg.mode.${next}`);
  }

  setMode(mode: DriveMode): void { this.drivetrain.setMode(mode); }

  /** Teleport to a pose, zero velocities, align to the ground. */
  reset(pos: THREE.Vector3, headingRad: number): void {
    const groundY = this.hm.sample(pos.x, pos.z);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), headingRad);
    this.body.setTranslation({ x: pos.x, y: groundY + TROOPER.restHeight + 0.15, z: pos.z }, true);
    this.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.drivetrain.state.gear = 1;
    this.flippedFor = 0;
    this.syncVisual();
  }

  fixedUpdate(dt: number, input: InputState): void {
    const c = this.controller;
    const t = this.telemetry;
    const dtr = this.drivetrain;

    // Pose vectors.
    const p = this.body.translation(), q = this.body.rotation(), v = this.body.linvel();
    this.position.set(p.x, p.y, p.z); this.quaternion.set(q.x, q.y, q.z, q.w);
    this.forward.set(0, 0, 1).applyQuaternion(this.quaternion);
    this.up.set(0, 1, 0).applyQuaternion(this.quaternion);
    this.velocity.set(v.x, v.y, v.z);
    const forwardSpeed = this.velocity.dot(this.forward);

    // Steering: reduce lock with speed so the truck doesn't dart at 80 km/h.
    const speedFactor = 1 - 0.6 * Math.min(1, Math.abs(forwardSpeed) / 25);
    const targetSteer = input.steer * TROOPER.maxSteerRad * speedFactor;
    this.steerAngle += (targetSteer - this.steerAngle) * Math.min(1, dt * 9);
    // Rapier's positive steering angle turns towards +X, which is the truck's left; input +1 means right.
    c.setWheelSteering(0, -this.steerAngle);
    c.setWheelSteering(1, -this.steerAngle);

    // Drivetrain.
    const movingForward = forwardSpeed > 0.5, movingBack = forwardSpeed < -0.5;
    const wantsReverse = input.reverse && !movingForward;
    const throttle = dtr.state.gear < 0 ? (input.reverse ? 1 : 0) : input.throttle;
    dtr.update(dt, throttle, wantsReverse, forwardSpeed, this.spinEstimate);
    const driven = this.mode === '2H' ? [2, 3] : [0, 1, 2, 3];
    const forcePerWheel = (dtr.state.wheelTorqueNm / TROOPER.wheelRadius) / driven.length;

    // Braking: brake pedal when moving against the pedal's direction; otherwise it's reverse throttle.
    const brakePedal = dtr.state.gear < 0 ? (input.throttle > 0 && movingBack ? 1 : 0) : (input.brake > 0 && movingForward ? input.brake : 0);
    const engineBrake = dtr.state.engineBrakeNm / TROOPER.wheelRadius / driven.length * 0.02;

    let contacts = 0, slipSum = 0;
    for (let i = 0; i < 4; i++) {
      const w = t.wheels[i];
      w.contact = c.wheelIsInContact(i);
      if (w.contact) contacts++;
      const cp = c.wheelContactPoint(i);
      w.sand = w.contact && cp ? this.hm.sampleSand(cp.x, cp.z) : 0;
      const len = c.wheelSuspensionLength(i) ?? TROOPER.suspension.restLength;
      w.compression = Math.max(0, Math.min(1, (TROOPER.suspension.restLength - len) / TROOPER.suspension.maxTravel));

      // Surface grip: blend between rock and sand by sandiness; a dug-in wheel loses more.
      const grip = (TROOPER.grip.rock + (TROOPER.grip.sand - TROOPER.grip.rock) * w.sand) * (1 - 0.35 * w.dig);
      c.setWheelFrictionSlip(i, grip);

      const isDriven = driven.includes(i);
      c.setWheelEngineForce(i, isDriven ? forcePerWheel : 0);

      let brake = 0;
      const maxB = i < 2 ? TROOPER.brakes.maxFront : TROOPER.brakes.maxRear;
      brake += brakePedal * maxB;
      if (input.handbrake && i >= 2) brake += TROOPER.brakes.handbrake;
      if (isDriven) brake += engineBrake;
      // Loose sand: rolling resistance that yields to momentum, and grows as spinning wheels dig in.
      const momentum = 1 - Math.min(1, Math.abs(forwardSpeed) / 14);
      brake += w.contact ? TROOPER.sandDrag * w.sand * w.sand * (0.5 + 0.5 * momentum) * (1 + 3 * w.dig) : 0;
      // Parking: hold still when no input so it doesn't creep down slopes.
      if (throttle === 0 && brakePedal === 0 && Math.abs(forwardSpeed) < 0.3 && !input.reverse && dtr.state.gear !== 0) brake += 25;
      c.setWheelBrake(i, brake);

      // Longitudinal slip estimate from the forward impulse vs. max available.
      const fi = Math.abs(c.wheelForwardImpulse(i) ?? 0);
      const sf = c.wheelSuspensionForce(i) ?? 0;
      const maxI = sf * dt * grip;
      w.slip = w.contact && maxI > 1e-3 ? Math.min(1, fi / maxI) : 0;
      // Digging: traction-limited driven wheels on sand sink; rolling freely lets them climb out.
      const spinning = isDriven && w.slip > 0.92 && throttle > 0.3 && Math.abs(forwardSpeed) < 6;
      w.dig = Math.max(0, Math.min(1, w.dig + (spinning ? TROOPER.digRate * w.sand : -TROOPER.digRecover) * dt));
      slipSum += w.slip;
    }

    c.updateVehicle(dt);

    // Telemetry.
    t.forwardSpeed = forwardSpeed;
    t.speedKmh = Math.abs(forwardSpeed) * 3.6;
    t.rpm = dtr.state.rpm; t.gear = dtr.state.gear; t.mode = dtr.state.mode;
    t.throttle = throttle; t.brake = brakePedal; t.steer = this.steerAngle / TROOPER.maxSteerRad;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.quaternion);
    t.pitchDeg = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(this.forward.y, -1, 1)));
    t.rollDeg = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(right.y, -1, 1)));
    t.upright = this.up.y > 0.35;
    t.airborne = contacts === 0;
    this.flippedFor = t.upright ? 0 : this.flippedFor + dt;
    // Wheel spin estimate: driven wheels at the traction limit while the truck is slow.
    const drivenSlip = driven.reduce((a, i) => a + t.wheels[i].slip, 0) / driven.length;
    const spinTarget = drivenSlip > 0.9 && throttle > 0.2 && Math.abs(forwardSpeed) < 8 ? 1 : 0;
    this.spinEstimate += (spinTarget - this.spinEstimate) * Math.min(1, dt * 4);
    t.wheelSpin = this.spinEstimate;
    void slipSum;
  }

  /** Seconds the truck has been on its side/roof (for auto-recovery prompts). */
  get flippedSeconds(): number { return this.flippedFor; }

  syncVisual(): void {
    const p = this.body.translation(), q = this.body.rotation();
    const root = this.visual.root;
    root.position.set(p.x, p.y, p.z);
    root.quaternion.set(q.x, q.y, q.z, q.w);
    const c = this.controller;
    for (let i = 0; i < 4; i++) {
      const w = this.visual.wheels[i];
      const cs = this.wheelLocal[i];
      const len = c.wheelIsInContact(i) ? (c.wheelSuspensionLength(i) ?? TROOPER.suspension.restLength) : TROOPER.suspension.restLength + TROOPER.suspension.maxTravel * 0.5;
      w.position.set(cs.x, cs.y - len, cs.z);
      w.rotation.set(0, c.wheelSteering(i) ?? 0, 0);
      const spin = w.children[0];
      spin.rotation.x = c.wheelRotation(i) ?? 0;
    }
    if (this.visual.steeringWheel) this.visual.steeringWheel.rotation.z = this.steerAngle * 2.4;
  }

  setHeadlights(on: boolean): void {
    for (const l of this.visual.headlights) l.intensity = on ? 40 : 0;
  }
}
