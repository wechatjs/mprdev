import { channelService } from './channel-service';
import { Target } from './target';
import { Devtool } from './devtool';
import { ChannelEventName, ChannelStatus } from './enum';

export class Channel {
  public id: string = '';
  private internalTargets: Target[] = [];
  private internalDevtools: Devtool[] = [];

  get targets() {
    return this.internalTargets;
  }

  get devtools() {
    return this.internalDevtools;
  }

  get status() {
    return this.targets.length > 0 && this.devtools.length > 0 ? ChannelStatus.ENABLE
      : this.targets.length > 0 && this.devtools.length === 0 ? ChannelStatus.TARGET_AWAITS
        : this.targets.length === 0 && this.devtools.length === 0 ? ChannelStatus.DISABLE
          : ChannelStatus.DISABLING;
  }

  get isBuilt() {
    return this.targets.length > 0 && this.devtools.length === 1;
  }

  constructor() { }

  public addTarget(target: Target) {
    if (!this.id) {
      this.id = target.info.targetId;
    }
    target.ws.on('message', this.handleTargetMessage.bind(this));
    target.ws.on('close', this.handleTargetClose.bind(this, target));
    target.ws.send('connected');
    this.internalTargets.push(target);
    channelService.fireChannelChange(ChannelEventName.TARGET_ADD, this);
  }

  public addDevtool(devtool: Devtool) {
    devtool.ws.on('message', this.handleDevtoolMessage.bind(this));
    devtool.ws.on('close', this.handleDevtoolClose.bind(this, devtool));
    this.internalDevtools.push(devtool);
    channelService.fireChannelChange(ChannelEventName.DEVTOOL_ADD, this);
    // *检查频道是否首次建立
    this.isBuilt && channelService.fireChannelChange(ChannelEventName.CHANNEL_BUILT, this);
  }

  private sendMessageToOpponent(targets: Target[] | Devtool[], buffer: Buffer) {
    targets.forEach((target: Target | Devtool) => {
      const message = buffer.toString();
      target.ws.send(message);
    });
  }

  handleTargetMessage(buffer: Buffer) {
    this.sendMessageToOpponent(this.internalDevtools, buffer);
  }

  handleDevtoolMessage(buffer: Buffer) {
    this.sendMessageToOpponent(this.internalTargets, buffer);
  }

  handleTargetClose(target: Target) {
    this.internalTargets = this.internalTargets.filter(item => item !== target);
    channelService.fireChannelChange(ChannelEventName.TARGET_REMOVE, this);
    // 如果已经没有 target 了，要把对应的所有 devtool 关掉
    if (this.internalTargets.length === 0) {
      this.internalDevtools.forEach(devtool => devtool.ws.close());
    }
  }

  handleDevtoolClose(devtool: Devtool) {
    this.internalDevtools = this.internalDevtools.filter(item => item !== devtool);
    this.handleDevtoolMessage(Buffer.from('{"id":-1,"method":"Debugger.disable"}'));
    channelService.fireChannelChange(ChannelEventName.DEVTOOL_REMOVE, this);
    // *检查频道是否还可用
    this.status === ChannelStatus.DISABLE && channelService.fireChannelChange(ChannelEventName.CHANNEL_EMPTY, this);
  }
}