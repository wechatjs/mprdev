import { WebSocket } from 'ws';
import { TargetInfo } from './interface';

export class Target {
  constructor(
    public ws: WebSocket,
    public info: TargetInfo,
  ) {
 
  }
}