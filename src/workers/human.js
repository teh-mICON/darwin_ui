import _ from 'lodash'
export default class Actor {
  constructor() {
    this.speciesId = 'human';
    this.callback = () => {
      console.log('YOU DED')
    };

    this.age = 0;
    this.history = [];

    this.state = {
      food: 10,
      water: 10,
      energy: 1000,
      facing: 'up',
      vision: {
        mountain: [],
        water: [],
        tree: [],
        hive: [],
        creature: []
      }
    }
    this.alive = false;
  }
  connect() {
    try {
      this.ws = new WebSocket('ws://localhost:3000');
      this.ws.onclose = event => {
        this.connect();
        this.callback(this);
      }
      this.ws.onopen = event => {
        try {
          this.send('init', { speciesId: this.speciesId })
        } catch (error) {
          return;
        }
      };
    } catch (error) {
      console.error(error)
    }

    this.ws.addEventListener('message', messageJSON => {
      const message = JSON.parse(messageJSON.data);
      const method = this['_' + message.event]
      if (method === undefined) {
        throw new Error('Unknown action: ' + message.event)
      }

      method.apply(this, [message]);
    });

    this.alive = true;
  }

  _init(message) {
    this.id = message.id;
    this.send('status')
  }

  _error(message) {
    console.log('ERROR EVENT')
    console.error(message)
  }
  _die(message) {
    this.ws.close();
    this.age = message.age
  }
  _pain(message) {
  }
  _turn(message) {
    this.state.facing = message.direction;
  }
  _hunger(message) {
  }
  _eat(message) {
  }
  _thirst(message) {
  }
  _drink(message) {
  }
  _feed(message) {
  }
  _status(message) {
    this.send('status')
    self.postMessage(message)
  }
  _move(message) {

  }
  addToActivation(input, type) {
    _.each(this.state.vision[type], tile => {
      input.push(tile.x)
      input.push(tile.y)
    })
    _.times(30 - this.state.vision[type].length * 2, () => { input.push(0) });
    return input;
  }
  send(event, message = {}) {
    this.history.push({ event, ...message })
    message.event = event;
    this.ws.send(JSON.stringify(message));
  }
  activate(values) {
    
  }

  turnLeft() {
    this.send('turn', { direction: 'left' });
  }
  turnRight() {
    this.send('turn', { direction: 'right' });
  }
  move() {
    this.send('move');
  }
  eat() {
    this.send('eat');
  }
  drink() {
    this.send('drink');
  }
  attack() {
    this.send('attack');
  }
}

const actor = new Actor();
actor.connect();

self.onmessage = message => {
  switch(message.data.key) {
    case 37: actor.turnLeft(); break;
    case 39: actor.turnRight(); break;
    case 38: actor.move(); break;

    case 81: actor.attack(); break; // Q
    case 87: actor.drink(); break; // W
    case 69: actor.eat(); break; // E
  }
}