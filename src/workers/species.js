import _ from 'lodash'

class SocketWrap {
  constructor(url) {
    this.url = url;
    this.handlers = {};
  }

  setHandler(event, handler) {
    this.handlers[event] = handler;
  }

  connect() {
    this.ws = new WebSocket(this.url);
    _.each(this.handlers, (handler, event) => {
      this.ws.addEventListener(event, handler);
    });

    this.ws.onerror = event => {
      this.ws.close();
    }

    this.ws.onclose = event => {
      this.connect();
    }
  }

  send(message) {
    this.ws.send(message)
  }
}

const wrapper = new SocketWrap('ws://localhost:8004');
wrapper.setHandler('message', message => {
  self.postMessage(JSON.parse(message.data))
});
wrapper.connect();


self.onmessage = message => {
  if(message.data.event == 'reset') {
    wrapper.send(JSON.stringify(message.data))
  }
}