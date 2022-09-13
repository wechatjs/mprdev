import { WebSocket } from 'ws';
import { DevtoolInfo } from './interface';

export class Devtool {
  constructor(
    public ws: WebSocket,
    public info: DevtoolInfo,
  ) {

  }
}