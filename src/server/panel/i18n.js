const matchUrl = (key) => location.href.match(new RegExp(`(\\\\?|&)${key}=([^&]*)(&|$)`));
export const lang = matchUrl('lang')?.[2];

const wordings = {
  cn: {
    RemoteDevTools: '远程调试',
    Refresh: '刷新',
    Search: '搜索',
    Title: '标题',
    DeviceId: '设备ID',
    AnonymousSite: '未命名网站',
    ConnectTime: '接入时间',
    InspectNum: '%s人正在调试',
    Inspect: '调试',
    EmptyTips: '暂无设备接入',
    DateFormat: '%m月%d日',
    TimeAscending: '时间升序', 
    TimeDescending: '时间降序',
    UINAscending: 'UIN升序',
    UINDescending: 'UIN降序',
    InspectBySSL: '通过安全信道调试 (默认)',
    InspectByNoSSL: '通过非安全信道调试',
  },
  en: {
    RemoteDevTools: 'DevTools',
    Refresh: 'Refresh',
    Search: 'Search',
    Title: 'Title',
    DeviceId: 'Device ID',
    AnonymousSite: 'Anonymous Site',
    ConnectTime: 'Connect Time',
    InspectNum: '%s people is inspecting',
    Inspect: 'Inspect',
    EmptyTips: 'No Connected Devices',
    DateFormat: '%d/%m',
    TimeAscending: 'Time Ascending', 
    TimeDescending: 'Time Descending',
    UINAscending: 'UIN Ascending',
    UINDescending: 'UIN Descending',
    InspectBySSL: 'Inspect by secure channel (default)',
    InspectByNoSSL: 'Inspect by insecure channel',
  },
};

export default wordings[lang] || wordings.cn;
