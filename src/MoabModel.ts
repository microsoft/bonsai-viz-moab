/*
* MoabModel.ts
* Copyright: Microsoft 2019
*
* Data model for moab simulator.
*/

export const DefaultBallRadius = 0.020;
export const DefaultPlateZ = 0.042;  // mm
export const PlateOriginToSurfaceOffset = 0.009; // mm

export interface ModelState {
    // time
    timeDelta: number;

    // ball
    ballRadius: number;

    ballPosX: number;
    ballPosY: number;
    ballPosZ: number;

    ballVelX: number;
    ballVelY: number;
    ballVelZ: number;

    ballOrientX: number;
    ballOrientY: number;
    ballOrientZ: number;
    ballOrientW: number;

    // ball estimated positions
    estimatedPosX: number;
    estimatedPosY: number;
    estimatedRadius: number;

    estimatedVelX: number;
    estimatedVelY: number;

    // target
    targetPosX: number;
    targetPosY: number;

    // obstacle
    obstaclePosX: number;
    obstaclePosY: number;
    obstacleRadius: number;

    // plate
    platePosX: number;
    platePosY: number;
    platePosZ: number;

    plateNorX: number;
    plateNorY: number;
    plateNorZ: number;

    // joystick, RH coordinate system
    pitch: number;
    roll: number;

    // meta
    terminal: boolean;
    reward: number;
}

export interface MoabModel {
    state: ModelState;
}
