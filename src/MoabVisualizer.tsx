/*
 * MoabVisualizer.tsx
 * Copyright: Microsoft 2019
 *
 * Visualizer app for the moab simulator.
 */

import {
  CompatibleVersion,
  IterationUpdateMessage,
  MessageType,
  QueryParams,
  ThemeMode,
} from "microsoft-bonsai-visualizer";
import React, { Component } from "react";
import * as semver from "semver";

import {
  DefaultBallRadius,
  DefaultPlateZ,
  MoabModel,
  PlateOriginToSurfaceOffset,
} from "./MoabModel";
import { MoabRenderer } from "./MoabRenderer";

interface MoabVisualizerProps {}
interface MoabVisualizerState {
  theme: ThemeMode;
  isModelValid: boolean;
  model: MoabModel;
}

export default class MoabVisualizer extends Component<
  MoabVisualizerProps,
  MoabVisualizerState
> {
  private _activeGamepadIndex: number | undefined;
  private _keyboardInput: number[] = [0, 0, 0];

  constructor(props: MoabVisualizerProps) {
    super(props);

    const queryParams = new URLSearchParams(window.location.search);
    const initialTheme = this._getInitialTheme(queryParams);

    this.state = {
      theme: initialTheme,
      isModelValid: true,
      model: {
        state: {
          timeDelta: 0.02,

          ballRadius: DefaultBallRadius,

          ballPosX: 0,
          ballPosY: 0,
          ballPosZ:
            DefaultPlateZ + PlateOriginToSurfaceOffset + DefaultBallRadius,

          ballVelX: 0,
          ballVelY: 0,
          ballVelZ: 0,

          ballOrientX: 0,
          ballOrientY: 0,
          ballOrientZ: 0,
          ballOrientW: 1,

          estimatedPosX: 0,
          estimatedPosY: 0,
          estimatedRadius: DefaultBallRadius,

          estimatedVelX: 0,
          estimatedVelY: 0,

          targetPosX: 0,
          targetPosY: 0,

          obstaclePosX: 0.03,
          obstaclePosY: 0.03,
          obstacleRadius: 0,

          platePosX: 0,
          platePosY: 0,
          platePosZ: DefaultPlateZ,

          plateNorX: 0,
          plateNorY: 0,
          plateNorZ: 1,

          pitch: 0,
          roll: 0,

          terminal: false,
          reward: 0,
        },
      },
    };
  }

  componentDidMount(): void {
    window.addEventListener("message", this._receiveMessage);
  }

  componentWillUnmount(): void {
    window.removeEventListener("message", this._receiveMessage);
  }

  render(): JSX.Element {
    return (
      <MoabRenderer
        theme={this.state.theme}
        isModelValid={this.state.isModelValid}
        moabModel={this.state.model}
      />
    );
  }

  private _handleKeyDown = (evt: Event) => {
    const keyEvent = evt as KeyboardEvent;
    let keyHandled = false;
    const keyboardAxisAmount = 0.2;
    const keyboardUpDownAmount = 1;

    if (keyEvent.code === "ArrowLeft") {
      this._keyboardInput[0] = -keyboardAxisAmount;
      keyHandled = true;
    } else if (keyEvent.code === "ArrowRight") {
      this._keyboardInput[0] = keyboardAxisAmount;
      keyHandled = true;
    } else if (keyEvent.code === "ArrowUp") {
      this._keyboardInput[1] = -keyboardAxisAmount;
      keyHandled = true;
    } else if (keyEvent.code === "ArrowDown") {
      this._keyboardInput[1] = keyboardAxisAmount;
      keyHandled = true;
    } else if (keyEvent.code === "BracketLeft") {
      this._keyboardInput[2] = keyboardUpDownAmount;
      keyHandled = true;
    } else if (keyEvent.code === "BracketRight") {
      this._keyboardInput[2] = -keyboardUpDownAmount;
      keyHandled = true;
    }

    if (keyHandled) {
      evt.stopPropagation();
      evt.preventDefault();
    }
  };

  private _receiveMessage = (evt: Event) => {
    if (evt.type !== "message") {
      return;
    }

    const messageStr = (evt as any).data;
    if (typeof messageStr !== "string") return;

    let message: IterationUpdateMessage;
    try {
      message = JSON.parse(messageStr);
    } catch (err) {
      return;
    }
    if (!semver.satisfies(message.version, CompatibleVersion)) {
      return;
    }
    if (message.type !== MessageType.IterationUpdate) {
      return;
    }

    const state = message.state as { [key: string]: any };
    const ballRadius = state["ball_radius"] ?? DefaultBallRadius;

    // Handle legacy parameters
    let roll = state["roll"];
    if (roll === undefined) {
      roll = state["tilt_x"];
    }

    let pitch = state["pitch"];
    if (pitch === undefined) {
      pitch = state["tilt_y"];
    }

    let obstaclePosX = state["obstacle_x"];
    if (obstaclePosX === undefined) {
      obstaclePosX = state["obstacle_pos_x"];
    }

    let obstaclePosY = state["obstacle_y"];
    if (obstaclePosY === undefined) {
      obstaclePosY = state["obstacle_pos_y"];
    }

    let platePosX = state["plate_x"];
    if (platePosX === undefined) {
      platePosX = state["plate_pos_x"];
    }

    let platePosY = state["plate_y"];
    if (platePosY === undefined) {
      platePosY = state["plate_pos_y"];
    }

    let platePosZ = state["plate_z"];
    if (platePosZ === undefined) {
      platePosZ = state["plate_pos_z"];
    }

    let targetPosX = state["target_x"];
    if (targetPosX === undefined) {
      targetPosX = state["target_pos_x"];
    }

    let targetPosY = state["target_y"];
    if (targetPosY === undefined) {
      targetPosY = state["target_pos_y"];
    }

    const newState: MoabVisualizerState = {
      theme: this.state.theme,
      isModelValid: true,
      model: {
        state: {
          timeDelta: state["time_delta"] ?? 0.02, // 20ms

          ballRadius: ballRadius,

          ballPosX: state["ball_x"] ?? 0.0,
          ballPosY: state["ball_y"] ?? 0.0,
          ballPosZ:
            state["ball_z"] ??
            PlateOriginToSurfaceOffset + DefaultPlateZ + ballRadius,

          ballVelX: state["ball_vel_x"] ?? 0.0,
          ballVelY: state["ball_vel_y"] ?? 0.0,
          ballVelZ: state["ball_vel_z"] ?? 0.0,

          ballOrientX: state["ball_qat_x"] ?? 0.0,
          ballOrientY: state["ball_qat_y"] ?? 0.0,
          ballOrientZ: state["ball_qat_z"] ?? 0.0,
          ballOrientW: state["ball_qat_w"] ?? 1.0,

          estimatedPosX: state["estimated_x"],
          estimatedPosY: state["estimated_y"],
          estimatedRadius: state["estimated_radius"],

          estimatedVelX: state["estimated_vel_x"],
          estimatedVelY: state["estimated_vel_y"],

          targetPosX: targetPosX ?? 0.0,
          targetPosY: targetPosY ?? 0.0,

          obstaclePosX: obstaclePosX ?? 0.03,
          obstaclePosY: obstaclePosY ?? 0.03,
          obstacleRadius: state["obstacle_radius"] ?? 0.0,

          platePosX: platePosX ?? 0.0,
          platePosY: platePosY ?? 0.0,
          platePosZ: platePosZ ?? DefaultPlateZ,

          plateNorX: state["plate_nor_x"] ?? 0.0,
          plateNorY: state["plate_nor_y"] ?? 0.0,
          plateNorZ: state["plate_nor_z"] ?? 1.0,

          roll: roll ?? 0.0,
          pitch: pitch ?? 0.0,

          terminal: !!state["terminal"],
          reward: state["reward"],
        },
      },
    };

    this.setState(newState);
  };

  private _getInitialTheme(queryParams: URLSearchParams): ThemeMode {
    const theme = queryParams.get(QueryParams.Theme);
    return theme === ThemeMode.Dark ? ThemeMode.Dark : ThemeMode.Light;
  }
}
