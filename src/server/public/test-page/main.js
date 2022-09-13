import Vue from './vue.js';

new Vue({
  el: '#app',
  template: '<div id="app">'
    + '<div class="box" :style="boxStyle" @click="click"></div>'
    + '</div>',
  data: {
    color: false
  },
  computed: {
    boxStyle() {
      return {
        border: '1px solid red',
        background: this.color ? 'blue' : 'white'
      };
    }
  },
  methods: {
    click() {
      const newColor = !this.color;
      this.color = newColor;
      console.log(newColor);
    }
  }
});