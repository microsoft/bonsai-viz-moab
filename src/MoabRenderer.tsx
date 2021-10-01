/*
 * MoabRenderer.tsx
 * Copyright: Microsoft 2019
 *
 * Renders the moab simulator and ball in 3D.
 */

import React, { Component } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';
import { PMREMGenerator } from 'three/src/extras/PMREMGenerator';

import { DefaultPlateZ, MoabModel, PlateOriginToSurfaceOffset } from './MoabModel';

interface MoabRendererProps {
    theme: 'light' | 'dark';
    isModelValid: boolean;
    moabModel: MoabModel;
}

interface MoabRendererState {}

const xAxis = new THREE.Vector3(1, 0, 0);
// const yAxis = new THREE.Vector3(0, 1, 0);
const zAxis = new THREE.Vector3(0, 0, 1);

export class MoabRenderer extends Component<MoabRendererProps, MoabRendererState> {
    private _container: HTMLDivElement | null = null;
    private _scene?: THREE.Scene;
    private _camera?: THREE.PerspectiveCamera;
    private _renderer?: THREE.WebGLRenderer;
    private _ballTexture?: THREE.Texture;
    private _ball?: THREE.Mesh;
    private _target?: THREE.Mesh;
    private _obstacle?: THREE.Mesh;
    private _plate?: THREE.Object3D;
    private _calibrationMarker?: THREE.Mesh[];
    private _joystick?: THREE.Object3D;
    private _estimatedPos?: THREE.Mesh;
    private _estimatedVel?: THREE.ArrowHelper;

    // arm meshes for left/center/right
    private _armLeft?: THREE.Object3D;
    private _armCenter?: THREE.Object3D;
    private _armRight?: THREE.Object3D;

    private _plateOrig = new THREE.Vector3();
    private _plateSurfaceOrig = new THREE.Vector3();
    constructor(props: MoabRendererProps) {
        super(props);

        this.state = {};
    }

    componentDidMount(): void {
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        this._renderer = new THREE.WebGLRenderer({ antialias: true });
        this._scene = new THREE.Scene();

        // Create the ball.
        this._ballTexture = THREE.ImageUtils.loadTexture('ballTexture.png');
        const ballGeom = new THREE.SphereGeometry(1.0, 32, 32);
        const ballMat = new THREE.MeshLambertMaterial({});
        ballMat.map = this._ballTexture!;
        this._ball = new THREE.Mesh(ballGeom, ballMat);
        this._ball.castShadow = true;

        // Create target as axes helper
        const coneHeight = 0.02;
        const coneGeom = new THREE.ConeGeometry(0.005, coneHeight, 32);
        coneGeom.translate(0, -(coneHeight / 2.0), 0);
        const coneMat = new THREE.MeshStandardMaterial({ color: 'green', transparent: true, opacity: 0.5 });
        this._target = new THREE.Mesh(coneGeom, coneMat);

        // Create obstacle
        const obstacleGeom = new THREE.CircleGeometry(undefined, 32);
        const obstacleMat = new THREE.MeshBasicMaterial({ color: 'red', side: THREE.DoubleSide });
        this._obstacle = new THREE.Mesh(obstacleGeom, obstacleMat);

        // Create calibration marker at center of plate
        const calibrationMarkerArcs: THREE.RingGeometry[] = [];
        for (let i = 0; i < 3; i++) {
            calibrationMarkerArcs.push(
                new THREE.RingGeometry(
                    0.0075,
                    0.0085,
                    8,
                    8,
                    Math.PI / 2 + (i * 2 * Math.PI) / 3 - Math.PI / 3,
                    (2 * Math.PI) / 3
                )
            );
        }
        const markerMat = new THREE.MeshStandardMaterial({
            color: 0xdddddd,
            side: THREE.DoubleSide,
        });
        this._calibrationMarker = calibrationMarkerArcs.map((arc, index) => {
            const markerMesh = new THREE.Mesh(arc, markerMat);
            const moveAngle = Math.PI / 2 + (index * 2 * Math.PI) / 3;
            const markerPos = new THREE.Vector3(0.012 * Math.cos(moveAngle), 0.012 * Math.sin(moveAngle), 0.004);
            markerMesh.position.copy(markerPos);
            return markerMesh;
        });

        // Create the ball estimated position indicator at unit size
        const geometry = new THREE.RingGeometry(0.9, 1, 32);
        const material = new THREE.MeshBasicMaterial({ color: 0x0000ff, side: THREE.DoubleSide });
        this._estimatedPos = new THREE.Mesh(geometry, material);

        this._estimatedVel = new THREE.ArrowHelper(
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(0, 0, 0),
            0.1,
            0x0000ff
        );

        // Set up the renderer.
        // set the size of the drawingBuffer based on the size it's displayed.
        this._renderer.setSize(windowWidth, windowHeight);
        this._renderer.setPixelRatio(window.devicePixelRatio || 1);
        this._renderer.shadowMap.enabled = true;
        this._renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Create the Moab device.
        new RGBELoader()
            .setDataType(THREE.UnsignedByteType)
            .load('studio_small_02_1k.hdr', (texture: THREE.Texture) => {
                const options = {
                    minFilter: texture.minFilter,
                    magFilter: texture.magFilter,
                };

                const pmremGenerator = new PMREMGenerator(this._renderer!).fromEquirectangular(texture);
                const envMap = pmremGenerator.texture;

                // set to true to hide the main body
                let suppressed: Array<string> = []; // eslint-disable-line
                const debugSuppressMoabBody = false;

                // load scene
                const gltfLoader = new GLTFLoader();
                gltfLoader.load('moabDevice.glb', (object: GLTF) => {
                    object.scene.traverse((child: THREE.Object3D) => {
                        // Enable shadows.
                        child.receiveShadow = true;

                        // Set the envmap for all meshes.
                        const mesh = child as THREE.Mesh;
                        const material = mesh.material as THREE.MeshStandardMaterial;
                        if (material) {
                            material.envMap = envMap;
                        }

                        // Debug disable the body
                        if (debugSuppressMoabBody) {
                            if (
                                child.name === 'BOTTOM_HOUSING^MOAB_V2_MAIN_ASSEMBLY_SP' ||
                                child.name === 'TOP_COVER^MOAB_V2_MAIN_ASSEMBLY_SP'
                            ) {
                                suppressed.push(child.name);
                            }
                        }

                        // Create the L/R arms from the Center arm.
                        if (child.name === 'ARM_ASSEMBLY') {
                            // Center arm assembly
                            this._armCenter = child as THREE.Object3D;
                            const root = this._armCenter.parent;
                            const angle = (2.0 * Math.PI) / 3.0; // 120deg

                            // Left arm assembly
                            this._armLeft = (child as THREE.Object3D).clone();
                            this._armLeft.name = 'ARM_ASSEMBLY_LEFT';
                            root!.add(this._armLeft);
                            this._armLeft.applyMatrix4(new THREE.Matrix4().makeRotationAxis(zAxis, angle));

                            // Right arm assembly
                            this._armRight = (child as THREE.Object3D).clone();
                            this._armRight.name = 'ARM_ASSEMBLY_RIGHT';
                            root!.add(this._armRight);
                            this._armRight.applyMatrix4(new THREE.Matrix4().makeRotationAxis(zAxis, -angle));
                        }

                        // The plate is transparent.
                        if (child.name === '_BALANCE_PLATE^BALANCE_PLATE_ASSEMBLY001') {
                            const plateMat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
                            plateMat.transparent = true;
                            plateMat.opacity = 0.3;
                        }

                        // Pull out the child plate assembly.
                        if (child.name === 'BALANCE_PLATE_ASSEMBLY') {
                            this._plate = child as THREE.Object3D;

                            // Use the plate's original top surface to calculate where the
                            // ball should be positioned.
                            const plateBox = new THREE.Box3().setFromObject(this._plate);
                            plateBox.getCenter(this._plateOrig);
                            this._plateSurfaceOrig.setZ(plateBox.max.z);

                            // Move the Z coordinate to the top of the box.
                            this._plateOrig.setZ(plateBox.max.z);
                        }

                        // And the joystick.
                        if (child.name === 'ALPS_JOYSTICK_ASSEMBLY') {
                            this._joystick = child as THREE.Object3D;
                        }
                    }); // traverse scene

                    // Add our objects to the loaded scene so they're rotated along with everything else.
                    object.scene.add(this._ball!);
                    object.scene.add(this._estimatedPos!);
                    object.scene.add(this._estimatedVel!);
                    if (this._plate) {
                        if (this._target) {
                            this._plate.add(this._target);
                        }
                        if (this._obstacle) {
                            this._plate.add(this._obstacle);
                        }
                        if (this._calibrationMarker) {
                            this._calibrationMarker.forEach(marker => {
                                this._plate!.add(marker);
                            });
                        }
                    }

                    // Rotate whole scene from Z-Up RH. Everything not in the system will be Y-Up RH coord.
                    object.scene.rotateX((Math.PI / 180.0) * -90);
                    object.scene.translateZ(-(this._plateSurfaceOrig.z + DefaultPlateZ));
                    this._scene!.add(object.scene);

                    // Remove suppressed objects.
                    suppressed.forEach((name: string) => {
                        const obj = this._scene!.getObjectByName(name);
                        if (obj) {
                            const parent = obj.parent;
                            parent!.remove(obj);
                        }
                    });

                    // Set up the camera.
                    this._camera = new THREE.PerspectiveCamera(40, windowWidth / windowHeight, 0.1, 1000);
                    this._camera.position.z = 0.375;
                    this._camera.position.y = 0.3;

                    // Set up point lights.
                    const locations = [[0, 1, 0]];
                    locations.forEach(loc => {
                        const light = new THREE.PointLight(0xffffff, 0.85, 50, 1.25);
                        light.position.set(loc[0], loc[1], loc[2]);
                        light.castShadow = true;
                        // Increase shadow map size from default of 512.
                        light.shadow.mapSize.width = 2048;
                        light.shadow.mapSize.height = 2048;
                        light.shadow.camera.near = 0.5;
                        light.shadow.camera.far = 100;
                        this._scene!.add(light);
                    });

                    // Set up ambient light.
                    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
                    this._scene!.add(ambientLight);

                    // Install handlers
                    window.addEventListener('resize', this._onWindowResize, false);

                    this._container!.appendChild(this._renderer!.domElement);

                    // Add controls. These are in Y-Up RH coordinate system
                    const controls = new OrbitControls(this._camera, this._renderer!.domElement);
                    controls.target = new THREE.Vector3(0, -DefaultPlateZ, 0);
                    controls.enableZoom = false;
                    controls.enableKeys = false;
                    controls.addEventListener('change', () => {
                        if (this.props.isModelValid) {
                            this._render3DScene();
                        }
                    });
                    controls.update();
                }); // model load
            }); // texture load
    }

    componentWillUnmount(): void {
        // Uninstall handlers.
        window.removeEventListener('resize', this._onWindowResize);
    }

    render(): JSX.Element {
        if (this.props.isModelValid) {
            this._render3DScene();
        }
        return <div ref={ref => this._onMount(ref)} />;
    }

    // Arm kinematics trig
    // see file://../private/Kinematics.png for visual explanation
    private _anglesForArmJoints(v: number, h: number) {
        // break this out so it's clear which arm segment is which
        const a = 0.055; // lower arm joint-to-joint length
        const b = 0.055; // upper arm joint-to-joint length
        const c = Math.sqrt(Math.pow(v, 2) + Math.pow(h, 2)); // hypot

        const theta_hc = Math.asin(v / c);
        const theta_link = Math.acos((Math.pow(a, 2) + Math.pow(b, 2) - Math.pow(c, 2)) / (2 * a * b));
        const theta_ac = Math.acos((Math.pow(a, 2) + Math.pow(c, 2) - Math.pow(b, 2)) / (2 * a * c));

        // for positive h we use angle differences
        // for negative h we subtract sum from 180
        const theta_servo = h >= 0 ? theta_hc - theta_ac : Math.PI - (theta_hc + theta_ac);

        // do additional rotation to account for initial object positions
        // changing the initial positions of the geometry in the file will require re-tuning these
        return {
            theta_link: Math.PI + theta_link, // 180 + theta_link
            theta_servo: Math.PI * 2 - theta_servo, // 360 - theta_servo
        };
    }

    private _orientArm(armGroup: THREE.Object3D, platePos: THREE.Vector3, plateQ: THREE.Quaternion) {
        const plateArm = armGroup.getObjectByName('PLATE_ARM');
        const servoArm = armGroup.getObjectByName('SERVO_ARM');

        const armQ = armGroup.quaternion;
        if (plateArm && servoArm) {
            // ball contact point is 100mm from plate group origin, 9mm below surface origin
            const jointPosC = new THREE.Vector3(0, platePos.y + 0.1, 0)
                .applyQuaternion(armQ)
                .applyQuaternion(plateQ)
                .add(platePos);

            const v = jointPosC.z - armGroup.position.z; // vertical component relative to servo joint
            const h = jointPosC.y - armGroup.position.y; // horizontal component relative to servo joint

            const angles = this._anglesForArmJoints(v, h);
            plateArm.setRotationFromAxisAngle(xAxis, angles.theta_link);
            servoArm.setRotationFromAxisAngle(xAxis, angles.theta_servo);
        }
    }

    private _render3DScene() {
        if (!this._scene || !this._ball || !this._renderer || !this._camera) {
            return;
        }

        const backgroundColor = this.props.theme === 'light' ? 0x808080 : 0x1a1a1a;
        this._scene.background = new THREE.Color(backgroundColor);

        // get the model state, and roll up the vectors
        const moabState = this.props.moabModel.state;

        // plate
        const platePos = new THREE.Vector3(moabState.platePosX, moabState.platePosY, moabState.platePosZ).add(
            this._plateOrig
        );

        const plateNor = new THREE.Vector3(moabState.plateNorX, moabState.plateNorY, moabState.plateNorZ);

        const plateQ = new THREE.Quaternion().setFromUnitVectors(zAxis, plateNor);

        // ball
        const ballPos = new THREE.Vector3(moabState.ballPosX, moabState.ballPosY, moabState.ballPosZ).add(
            this._plateSurfaceOrig
        );

        // target
        const targetPos = new THREE.Vector3(moabState.targetPosX, moabState.targetPosY, PlateOriginToSurfaceOffset);

        // obstacle
        const obstaclePos = new THREE.Vector3(moabState.obstaclePosX, moabState.obstaclePosY, 0.0);

        const ballRot = new THREE.Quaternion(
            moabState.ballOrientX,
            moabState.ballOrientY,
            moabState.ballOrientZ,
            moabState.ballOrientW
        ).invert();
        // NOTE(Estee): I don't know why we need to apply the inverse quaternion to get the rotation
        // to go in the correct direction, but in the moab_predictor.py visualization we do not.
        // I suspect this is probably due to the raw GL being used vs THREE.js, but there may also be
        // some unresolved nonsense around the rotation math that is making this an issue.
        // I'm leaving this note for future generations that may have more time to go unroll this mystery.

        // ball ring
        const ballRingPos = new THREE.Vector3(
            moabState.estimatedPosX || moabState.ballPosX,
            moabState.estimatedPosY || moabState.ballPosY,
            moabState.platePosZ
        ).add(this._plateOrig);

        // adjust the joystick to match the control inputs
        if (this._joystick) {
            // [-1..1] -> +/-15deg joystick swing
            // roll is in a Z-Up RH coord system, and must be inverted
            // because rendering is in a Y-up RH coord system
            const xAngle = (moabState.pitch * Math.PI) / 12;
            const yAngle = (moabState.roll * Math.PI) / 12;

            this._joystick.setRotationFromAxisAngle(new THREE.Vector3(0, 0, 1), 0);
            this._joystick.rotateX(xAngle);
            this._joystick.rotateY(yAngle);
        }

        // Set the ball radius based on model
        if (this._ball) {
            const r = moabState.ballRadius;
            this._ball.scale.set(r, r, r);

            // Set ball position based on model.
            this._ball.position.copy(ballPos);

            // Orient the ball
            this._ball.setRotationFromQuaternion(ballRot);
        }

        if (this._target) {
            this._target.position.copy(targetPos);
            this._target.rotation.set((3.0 * Math.PI) / 2.0, 0, 0);
            this._target.visible = targetPos.x !== 0 || targetPos.y !== 0;
        }

        // Set obstacle radius and position based on model
        if (this._obstacle) {
            const r = moabState.obstacleRadius;
            this._obstacle.scale.set(r, r, r);
            this._obstacle.position.copy(obstaclePos);
            this._obstacle.visible = moabState.obstacleRadius > 0.0;
        }

        // Set the radius and position of the estimated ball position indicator
        if (this._estimatedPos) {
            if (
                moabState.estimatedPosX !== undefined &&
                moabState.estimatedPosY !== undefined &&
                moabState.estimatedRadius !== undefined
            ) {
                const r = moabState.estimatedRadius;
                this._estimatedPos.scale.set(r, r, r);
                this._estimatedPos.position.copy(ballRingPos);
                this._estimatedPos.setRotationFromQuaternion(plateQ);
                this._estimatedPos.visible = true;
            } else {
                this._estimatedPos.visible = false;
            }
        }

        if (this._estimatedVel) {
            if (moabState.estimatedVelX !== undefined && moabState.estimatedVelY !== undefined) {
                const estimatedVel = new THREE.Vector3(moabState.estimatedVelX, moabState.estimatedVelY, 0);
                // If we use `length * moabState.timeDelta` we show the distance travelled in one time step
                // instead of the distance travelled in one second.
                const length = estimatedVel.length(); // * moabState.timeDelta;
                const dir = estimatedVel.normalize();

                this._estimatedVel.position.copy(ballRingPos);
                this._estimatedVel.setDirection(dir);
                this._estimatedVel.setLength(length, 0.003, 0.002);
                this._estimatedVel.visible = true;
            } else {
                this._estimatedVel.visible = false;
            }
        }

        // Orient the plate to match the model
        if (this._plate) {
            this._plate.position.copy(platePos);
            this._plate.setRotationFromQuaternion(plateQ);
        }

        // Orient the arms to contact the plate
        if (this._armCenter) {
            this._orientArm(this._armCenter, platePos, plateQ);
        }

        if (this._armLeft) {
            this._orientArm(this._armLeft, platePos, plateQ);
        }

        if (this._armRight) {
            this._orientArm(this._armRight, platePos, plateQ);
        }

        // Render scene.
        this._renderer.render(this._scene, this._camera);
    }

    private _onMount = (ref: HTMLDivElement | null) => {
        this._container = ref;
    };

    private _onWindowResize = () => {
        const width = window.innerWidth;
        const height = window.innerHeight;

        if (!this._camera || !this._renderer) {
            return;
        }

        this._camera.aspect = width / height;
        this._camera.updateProjectionMatrix();
        this._renderer.setSize(width, height);
    };
}
