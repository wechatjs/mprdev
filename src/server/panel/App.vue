<template>
  <t-layout class="page">
    <t-header class="header">
      <t-head-menu theme="dark">
        <div class="logo" slot="logo">
          {{ I18N.RemoteDevTools }}
        </div>
        <div class="header-operations" slot="operations">
          <t-button theme="primary" @click="getTargets" :loading="isLoading">{{ I18N.Refresh }}</t-button>
          <t-dropdown
            class="sort-dropdown"
            placement="bottom"
            maxColumnWidth="120"
            :options="sortOptions"
            :value="sortType"
            @click="handleSortTypeChange"
          >
            <t-button>
              <span class="dropdown-text">
                {{ sortType | filterSortType }}
                <t-icon name="chevron-down" size="small" />
              </span>
            </t-button>
          </t-dropdown>
          <t-input-adornment :prepend="I18N.Search" class="search">
            <t-input
              clearable
              class="searchbar"
              v-model="searchContent"
              :status="searchStatus"
              :placeholder="I18N.Title + ' / ' + I18N.DeviceId + ' / URL'"
            />
          </t-input-adornment>
          <t-button theme="default" shape="square" @click="switchTheme">
            <t-icon v-if="theme === 'dark'" name="sunny" />
            <t-icon v-else name="moon" />
          </t-button>
          <t-button theme="default" shape="square" @click="switchLang">
            <span v-if="lang === 'en'">中</span>
            <span v-else>EN</span>
          </t-button>
          <t-button theme="default" shape="square" @click="openGithub">
            <t-icon name="logo-github" />
          </t-button>
        </div>
      </t-head-menu>
    </t-header>
    <t-content class="content">
      <t-list v-if="list.length" :split="true">
        <t-list-item v-for="info in displayList" :key="info.targetId">
          <div class="info-box">
            <div class="info">
              <div class="main-info">
                <!-- favicon -->
                <t-avatar class="favicon" :image="info.favicon" size="small"></t-avatar>
                <!-- title tooltip:pageUrl -->
                <t-tooltip class="title" :content="info.pageUrl" show-arrow>{{ info.title || I18N.AnonymousSite }}</t-tooltip>
                <!-- tooltip:ua -->
                <t-tooltip class="ua" :content="info.ua" show-arrow v-if="info.ua">
                  <t-icon name="help-circle" size="small" />
                </t-tooltip>
              </div>
              <div class="extra-info">
                <t-tag theme="primary" size="small">{{ I18N.ConnectTime }}: {{ info.time | timeFormatter }}</t-tag>
                <span class="target">{{ I18N.DeviceId }}: {{ info.targetId }}<template v-if="info.devtoolNum"> ( {{ I18N.InspectNum.replace('%s', info.devtoolNum) }} )</template></span>
              </div>
            </div>
          </div>
          <div slot="action">
            <t-button theme="primary" @click="openDevTools(info.targetId)">{{ I18N.Inspect }}</t-button>
            <t-dropdown class="debug-options" trigger="click" :options="openOptions(info.targetId)" maxColumnWidth="200" placement="bottom-right">
              <t-button theme="default">
                <t-icon name="chevron-down" size="small" />
              </t-button>
            </t-dropdown>
          </div>
        </t-list-item>
      </t-list>
      <div class="empty" v-else>{{ I18N.EmptyTips }}</div>
    </t-content>
  </t-layout>
</template>

<script>
import I18N, { lang } from './i18n';

const BASE_URL = '/remote_dev'; // 不需要前缀时留空字符串
const INTERVAL = 30 * 1000; // 轮询时间间隔
const SORT = { // 排序枚举
  TIME_ASC: 0,
  TIME_DESC: 1,
};

export default {
  filters: {
    timeFormatter(val) {
      const date = new Date(+val);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hour = `${date.getHours()}`.padStart(2, '0');
      const minute = `${date.getMinutes()}`.padStart(2, '0');
      const second = `${date.getSeconds()}`.padStart(2, '0');
      return `${I18N.DateFormat.replace('%m', month).replace('%d', day)} ${hour}:${minute}:${second}`;
    },
    filterSortType(sortType) {
      switch (sortType) {
        case SORT.TIME_ASC: return I18N.TimeAscending;
        case SORT.TIME_DESC: return I18N.TimeDescending;
      }
    }
  },
  data() {
    let searchContent = '';
    try { searchContent = window.localStorage.getItem('__remote_dev_search_content__') || '' } catch { /* empty */ }

    let theme = 'light';
    try { theme = window.localStorage.getItem('__remote_dev_theme_mode__') || 'light' } catch { /* empty */ }

    return {
      list: [],
      sortOptions: [
        { content: I18N.TimeAscending, value: SORT.TIME_ASC },
        { content: I18N.TimeDescending, value: SORT.TIME_DESC },
      ],
      sortType: SORT.TIME_DESC,
      intervalTimer: null,
      isLoading: false,
      searchContent,
      theme,
      lang,
      I18N,
    };
  },
  computed: {
    displayList() {
      const filterList = this.searchContent
        ? this.list.filter((info) => `${info.targetId};;;${info.pageUrl};;;${info.title}`.includes(this.searchContent))
        : this.list;
      return filterList.sort(this.sorterFactory(this.sortType));
    },
    searchStatus() {
      if (this.searchContent) {
        return this.displayList.length ? 'success' : 'error';
      }
    },
  },
  watch: {
    searchContent(val) {
      try { window.localStorage.setItem('__remote_dev_search_content__', val) } catch { /* empty */ } // 缓存搜索结果
    },
  },
  created() {
    this.getTargets();
    this.intervalTimer = setInterval(() => {
      this.getTargets();
    }, INTERVAL);
  },
  mounted() {
    document.documentElement.setAttribute('theme-mode', this.theme);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.getTargets();
      }
    });
  },
  methods: {
    async getTargets() {
      if (this.isLoading) return;
      this.isLoading = true;

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const reqUrl = `${BASE_URL}/get_targets`;
        xhr.open('GET', reqUrl, true);
        xhr.onreadystatechange = () => {
          if (xhr.readyState === 4) {
            const { status } = xhr;
            if (status >= 200 && status < 400) {
              try {
                const { responseText } = xhr;
                const resp = JSON.parse(responseText); // 尝试解析json出来
                const tmpList = [];
                Object.keys(resp).forEach((key) => {
                  tmpList.push(resp[key]);
                });
                this.list = tmpList;
                resolve(tmpList);
              } catch (e) {
                reject({ type: 1, error: e, status });
              } finally {
                this.isLoading = false;
              }
            }
          }
        };
        xhr.send();
      });
    },
    openDevTools(target, secure) {
      const securePointed = secure !== undefined;

      const host = location.host;
      const protocol = securePointed ? secure : location.protocol;
      const wsProtocol = protocol === 'https:' ? 'wss' : 'ws';
      const devPanelUrl = `${host}/${BASE_URL.replace(/^\//, '')}/front_end/inspector.html`;
      const wsConnection = `${host}/devtool/${target}?targetId=${target}`;

      const url = `${protocol}//${devPanelUrl}?${wsProtocol}=${wsConnection}`;
      window.open(url);
    },
    handleSortTypeChange(e) {
      this.sortType = e.value;
    },
    // factory
    sorterFactory(type) {
      return (a, b) => {
        const isAsc = type === SORT.TIME_ASC;
        const aValue = a.time;
        const bValue = b.time;
        if (aValue < bValue) return isAsc ? -1 : 1;
        else if (aValue > bValue) return isAsc ? 1 : -1;
        return 0;
      }
    },
    openOptions(target) {
      return [
        { content: I18N.InspectBySSL, value: 0, onClick: this.openDevTools.bind(this, target, 'https:') },
        { content: I18N.InspectByNoSSL, value: 1, onClick: this.openDevTools.bind(this, target, 'http:') },
      ];
    },
    switchTheme() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('theme-mode', this.theme);
      try { window.localStorage.setItem('__remote_dev_theme_mode__', this.theme) } catch { /* empty */ } // 缓存主题
    },
    switchLang() {
      location.search = `?lang=${lang === 'en' ? 'cn' : 'en'}`;
    },
    openGithub() {
      window.open('https://github.com/wechatjs/mprdev', '_blank');
    },
  }
}
</script>

<style scoped>
.page {
  min-width: 700px;
  min-height: 100vh;
}

.logo {
  color: var(--td-brand-color-7);
  font-size: 26px;
  flex-shrink: 0;
}

.header-operations {
  display: flex;
  flex-direction: row;
}

.header-operations > *:not(:first-child) {
  margin-left: 8px;
}

.searchbar {
  width: 220px;
}

.sort-dropdown {
  margin-left: 24px;
}

.dropdown-text {
  display: inline-flex;
  align-items: center;
}

.dropdown-text .t-icon {
  margin-left: 4px;
}

.search {
  flex-shrink: 0;
} 

.content {
  height: calc(100vh - 64px);
}

.empty {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 30%;
  font-size: 18px;
  color: #888888;
}

.info-box {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.info {
  display: flex;
  flex-direction: column;
  margin: 0 8px;
}

.main-info {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.favicon {
  flex-shrink: 0;
}

.title {
  overflow: hidden;
  word-break: break-all;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}

.ua {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-shrink: 0;
}

.main-info > *:not(:first-child) {
  margin-left: 8px;
}

.extra-info {
  margin-top: 8px;
  display: flex;
}

.extra-info > *:not(:first-child) {
  margin-left: 8px;
}

.target {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}

.debug-options {
  margin-left: 8px;
}
</style>

<style>
html, body {
  min-height: 100vh;
}
.searchbar .t-input.t-is-success {
  border: 1px solid var(--td-border-level-2-color);
  background-color: var(--td-success-color-1);
}
.searchbar .t-input.t-is-error {
  border: 1px solid var(--td-border-level-2-color);
  background-color: var(--td-error-color-1);
}
</style>
