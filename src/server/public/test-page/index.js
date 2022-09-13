import '/remote_dev/sdk/index.js';

RemoteDevSdk.init({
  host: location.hostname,
  port: location.port,
  title: '远程调试测试页',
});

RemoteDevSdk.debugSrc('./main.js');