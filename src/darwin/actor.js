export default class Actor {
  constructor(speciesId, callback) {
    this.speciesId = speciesId;
    this.callback = callback;

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
  connect(network) {
    this.network = network;
    try {
      this.ws = new WebSocket('ws://localhost:3000');
      this.ws.onclose = event => {
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

    this.ws.addEventListener('message', msgJSON => {
      const msg = JSON.parse(msgJSON.data);
      const method = this['_' + msg.event]
      if (method === undefined) {
        throw new Error('Unknown action: ' + msg.event)
      }

      method.apply(this, [msg]);
    });

    this.alive = true;
  }

  _init(msg) {
    this.id = msg.id;
    this.send('status')
  }

  _error(msg) {
    console.log('ERROR EVENT')
    console.error(msg)
  }
  _die(msg) {
    this.ws.close();
    this.age = msg.age
  }
  _pain(msg) {
  }
  _turn(msg) {
    this.state.facing = msg.direction;
  }
  _hunger(msg) {
  }
  _eat(msg) {
  }
  _thirst(msg) {
  }
  _drink(msg) {
  }
  _feed(msg) {
  }
  _status(msg) {
    // add basic properties
    this.state.food = msg.creature.food;
    this.state.water = msg.creature.water;
    this.state.energy = msg.creature.energy;

    // add facing
    let facing;
    switch (this.state.facing) {
      case 'up': facing = [1, 0, 0, 0]; break;
      case 'right': facing = [0, 1, 0, 0]; break;
      case 'down': facing = [0, 0, 1, 0]; break;
      case 'left': facing = [0, 0, 0, 1]; break;
    }

    // add tiles
    const types = ['mountain', 'water', 'tree', 'hive', 'creature'];
    const result = {};
    _.each(types, type => result[type] = _.times(15, _.constant(0)));
    _.each(msg.creature.vision, (tile, index) => {
      if (tile === null) return;
      _.each(types, type => {
        if (tile.type == type) {
          result[type][index] = 1;
          return false;
        }
      })
    })

    // concat all activation values
    let activations = [this.state.food, this.state.water, this.state.energy].concat(facing);
    _.each(types, type => {
      activations = activations.concat(result[type]);
    })
    try {
      this.activate(activations)
      this.send('status')
    } catch (error) {
      console.log('activation error')
      console.error(error)
    }
  }
  _move(msg) {

  }
  addToActivation(input, type) {
    _.each(this.state.vision[type], tile => {
      input.push(tile.x)
      input.push(tile.y)
    })
    _.times(30 - this.state.vision[type].length * 2, () => { input.push(0) });
    return input;
  }
  send(event, msg = {}) {
    this.history.push({ event, ...msg })
    msg.event = event;
    this.ws.send(JSON.stringify(msg));
  }
  activate(values) {
    const activations = this.network.activate(values);

    let max = 0, maxKey;
    _.each(activations, (activation, index) => {
      if (index == 0) return;
      if (activation > max) {
        maxKey = index;
        max = activation;
      };
    });
    if (activations[0] > .5) this.send('move')
    switch (maxKey) {
      case 1: this.send('turn', { direction: 'right' }); break;
      case 2: this.send('turn', { direction: 'left' }); break;

      case 3: this.send('eat'); break;
      case 4: this.send('drink'); break;
      case 5: this.send('attack'); break;
    }
  }
}