export enum ChannelEventName {
  TARGET_ADD = 'target_add',
  TARGET_REMOVE = 'target_remove',
  DEVTOOL_ADD = 'devtool_add',
  DEVTOOL_REMOVE = 'devtool_remove',
  CHANNEL_BUILT = 'channel_built',
  CHANNEL_EMPTY = 'channel_empty',
}

export enum ChannelStatus {
  ENABLE = 'enable',
  TARGET_AWAITS = 'target_awaits',
  DISABLING = 'disabling',
  DISABLE = 'disable',
}