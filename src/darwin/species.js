import Actor from "./actor";
import uuid from 'uuid/v4';

const { Network, methods, architect } = require('@liquid-carrot/carrot');

class Species {
  constructor(id) {
    this.id = id;
  }

  /**
   * Create species from scratch
   */
  fresh() {
    // food + water + energy, facing, mountain, water, tree, hive, creature
    const input = 3 + 4 + 15 + 15 + 15 + 15 + 15;
    // move, turn, eat + drink + feed
    const output = 1 + 2 + 3

    this.elite = _.times(2, () => {
      return {
        id: uuid().substr(0, 6),
        network: new Network(input, output),
        actor: new Actor(this.id, this.callback.bind(this)),
        age: 0
      }
    });

    const blankNetwork = () => {
      return {
        network: new Network(input, output),
        actor: new Actor(this.id, this.callback.bind(this))
      }
    };
    this.omega = _.times(2, blankNetwork);
    this.wildcard = _.times(2, blankNetwork);
  }

  /**
   * Initialize blank species
   */
  initializeBlank() {
    this.fresh();
    this.check();
    this.ready();
  }

  /**
   * Create species from stored values
   */
  initializeStored(species) {
    this.fresh();
    this.elite = _.map(species.elite, elite => {
      return {
        id: elite.id,
        age: elite.age,
        network: Network.fromJSON(elite.network),
        actor: new Actor(this.id, this.callback.bind(this))
      }
    });

    this.check();
    this.ready();
  }
  /**
   * Initialize from single species
   */
  initializeNetwork(network) {
    this.fresh();
    this.elite[0].network = Network.fromJSON(network);
    this.check();
    this.ready();
  }

  /**
   * Main loop
   */
  check() {
    const elite = _.sortBy(this.elite, elite => -elite.age);

    // check each elite if they're still alive
    // if they're not, clone their network, mutate it
    // then reconnect with new network set
    _.each(elite, elite => {
      if (!elite.actor.alive) {
        let network = Network.fromJSON(elite.network.toJSON());
        _.times(7, () => {
          network = network.mutateRandom(methods.mutation.FFW, { maxNodes: 300, maxConnections: 1000, maxGates: 1000 });
        });
        elite.actor.connect(network);
      }
    });

    // check each omega if they're still alive
    // if not, sample 2 elites, cross them over
    // then reconnect with new network set
    _.each(this.omega, omega => {
      if (!omega.actor.alive) {
        const parentOne = _.sample(this.elite);
        const parentTwo = _.sample(_.filter(this.elite, elite => elite.id != parentOne.id));

        parentOne.network.score = parentOne.age;
        parentTwo.network.score = parentTwo.age;

        const crossover = Network.crossOver(parentOne.network, parentTwo.network, false);
        omega.actor.connect(crossover);
      }
    });

    // set wildcard (continuously evolving)
    _.each(this.wildcard, wildcard => {
      if (!wildcard.actor.alive) {
        const clone = Network.fromJSON(wildcard.network.toJSON());
        let network = clone;
        _.times(7, () => {
          network = network.mutateRandom(methods.mutation.FFW, { maxNodes: 300, maxConnections: 1000, maxGates: 1000 });
        });
        wildcard.network = clone;
        wildcard.actor.connect(network);
      }
    });

    setTimeout(() => { this.check() }, 1000);
  }

  /**
   * Death callback
   * when an actor dies, this is called
   * walk thru species elite, see if the actor was older than them (from oldest to 'youngest')
   * if they were, send elite message to darwin thread
   * 
   * also set the network and age for the particular elite
   */
  callback(actor) {
    let i = 0;
    _.each(this.elite, elite => {
      i++;
      if (elite.age < actor.age) {
        elite.network = actor.network;
        elite.age = actor.age;

        self.postMessage({
          event: 'elite',
          id: this.id,
          eliteLevel: i,
          age: actor.age,
          network: actor.network.toJSON()
        })
        self.postMessage({
          event: 'update',
          id: this.id,
          elite: _.map(this.elite, elite => {
            return {
              id: elite.id,
              age: elite.age,
              network: elite.network.toJSON(),
            }
          })
        })
        return false;
      }
    });
    actor.alive = false;
  }

  ready() {
    self.postMessage({
      event: 'ready',
      id: this.id,
      elite: _.map(this.elite, elite => {
        return {
          id: elite.id,
          age: elite.age,
          network: elite.network.toJSON(),
        }
      })
    })
  }
}
self.addEventListener('message', (message) => {
  const species = new Species(message.data.id);
  if(message.data.event == 'init_blank') {
    species.initializeBlank();
  } else if(message.data.event == 'init_stored') {
    species.initializeStored(message.data.species);
  } else if(message.data.event == 'init_network') {
    species.initializeNetwork(message.data.network);
  }
});