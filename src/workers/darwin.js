import uuid from "uuid/v4";
import axios from "axios";

const _ = require("lodash");
const { Network, methods, architect } = require("@liquid-carrot/carrot");

const speciesCount = 6;
const tickDelay = 1000 * 60 * 10

class Darwin {
  constructor() {
    this.worker = null;
    this.workers = {};
    this.species = {};

    this.uber = 0;
    this.uberHistory = []
    this.elapsedTime = 0;
    this.elapsedTimeInitial = 0;
    this.startTime = new Date();
  }

	/**
	 * Load stored state from database
	 * Report uber species to UI thread
	 */
  async initialize() {
    this.worker = await import("worker-loader!../darwin/species.js");

    this.species = await this.load("species");
    const generation = this.generation = await this.load("generation");
    const elapsedTime = this.elapsedTimeInitial = await this.load("elapsedTime");
    this.uberHistory = await this.load("uberHistory");
    this.uber = _.last(this.uberHistory).age

    this.sendStatus(generation, elapsedTime)

    if (Object.keys(this.species).length) {
      const sorted = this.getSpeciesSortedByEliteAge(this.species).reverse();
      const uberSpecies = sorted[0];
      const uberAlpha = this.getAlpha(uberSpecies.id)
      self.postMessage({
        event: "uber",
        id: uberSpecies.id,
        age: uberAlpha.age,
        network: uberAlpha.network,
        history: this.uberHistory
      });
    }
  }

  sendStatus(generation, elapsedTime) {
    this.save('generation', generation)
    this.save('elapsedTime', elapsedTime)

    self.postMessage({
      event: 'status',
      generation, elapsedTime
    })
  }

	/**
	 * Start evolving
	 */
  async goes() {
    await this.initialize();

    let i = 0;
    // create workers for stored species
    _.each(this.species, async species => {
      this.spawnStored(species);
    });

    // fill rest
    const left = speciesCount - Object.keys(this.species).length;
    _.times(left, async () => {
      this.spawnBlank();
    });

    self.setTimeout(() => {
      this.tick();
    }, tickDelay)
  }

  spawnBlank() {
    const id = uuid().substr(0, 6)
    this.spawn(id, { event: 'init_blank', id })
    return id;
  }

  spawnNetwork(network) {
    const id = uuid().substr(0, 6)
    this.spawn(id, { event: 'init_network', id, network });
    return id;
  }

  spawnStored(species) {
    this.spawn(species.id, { event: 'init_stored', id: species.id, species });
  }

  spawn(id, message) {
    const speciesWorker = this.worker.default();
    this.workers[id] = speciesWorker;
    speciesWorker.onmessage = message => {
      switch (message.data.event) {
        case "ready":
          this.msg_ready(message);
          break;
        case "update":
          this.msg_update(message);
          break;
        case "elite":
          this.msg_elite(message);
          break;
      }
    };
    speciesWorker.postMessage(message)
  }

  updateSpecies(message) {
    this.species[message.data.id] = {
      id: message.data.id,
      elite: message.data.elite
    };
    // update UI thread with new state of species
    self.postMessage({
      event: "update",
      id: message.data.id,
      elite: message.data.elite
    });
  }

	/**
	 * Species reports ready status
	 */
  msg_ready(message) {
    this.updateSpecies(message);
    self.postMessage({
      event: 'spawn',
      id: message.data.id
    })
  }

	/**
	 * Incoming species update from species worker
	 * Save new data for crossovers
	 */
  msg_update(message) {
    this.updateSpecies(message);
    // save all species to db
    this.save("species", this.species);
  }
	/**
	 * New Elite network found in species, forward to UI thread
	 */
  msg_elite(message) {
    self.postMessage(message.data);
    if (message.data.age > this.uber) {
      this.uber = message.data.age;
      this.uberHistory.push({
        id: message.data.id,
        age: message.data.age,
        elapsedTime: this.elapsedTime
      });
      self.postMessage({
        event: "uber",
        id: message.data.id,
        age: message.data.age,
        network: message.data.network,
        history: this.uberHistory
      });
      this.save('uberHistory', this.uberHistory)
    }
  }

	/**
	 * Return array of species sorted by age ASC
	 */
  getSpeciesSortedByEliteAge(candidates) {
    return _.sortBy(candidates, species => {
      const max = _.maxBy(species.elite, elite => elite.age);
      return max.age;
    });
  }

	/**
	 * Return the network with the highest age score
	 */
  getAlpha(speciesID) {
    const species = this.species[speciesID];
    return _.maxBy(species.elite, elite => elite.age);
  }

	/**
	 * Periodically cull 3 worst performing species
	 * Replace them with
	 * - blank species
	 * - Apex: crossover of 2 best performing species
	 * - Hybrid: crossover of 2 random species
	 */
  tick() {
    const culled = [];

    // cull 3 worst performing species
    const cull = () => {
      const sorted = this.getSpeciesSortedByEliteAge(this.species);
      const min = sorted[0];

      culled.push(min.id);
      this.workers[min.id].terminate();

      delete this.species[min.id];
      delete this.workers[min.id];
    };

    // create one fresh species
    this.spawnBlank(null);
    cull();

    // create one crossover species of 2 best performing species
    if (this.spawnApex()) {
      cull();
    }

    // create one crossover species of random elites
    if (this.spawnHybrid()) {
      cull();
    }

    self.postMessage({
      event: "cull",
      species: culled
    });

    this.sendStatus(++this.generation, this.getElapsedTime())

    setTimeout(this.tick.bind(this), tickDelay);
  }

  getElapsedTime() {
    return this.elapsedTimeInitial + (new Date() - this.startTime);
  }

  createSpeciesByAlphaIDs(idOne, idTwo) {
    const parentOne = Network.fromJSON(this.getAlpha(idOne).network);
    const parentTwo = Network.fromJSON(this.getAlpha(idTwo).network);
    return Network.crossOver(parentOne, parentTwo).toJSON();
  }

  spawnApex() {
    // find 2 best performing species
    const alphas = [];
    const filter = (species, speciesID) => {
      if (species === null) return false;
      if (_.includes(alphas, speciesID)) return false;
      return true;
    };

    _.times(2, () => {
      const filtered = _.pickBy(this.species, filter);
      const sorted = this.getSpeciesSortedByEliteAge(filtered);
      const max = sorted[0];
      alphas.push(max.id);
    });
    if (alphas[0] === null || alphas[1] === null) {
      self.postMessage({
        event: "error",
        message: "Not enough candidates to spawn apex"
      });
      return false;
    }

    const apexElite = this.createSpeciesByAlphaIDs(alphas[0], alphas[1]);
    const apexID = this.spawnNetwork(apexElite);
    self.postMessage({
      event: "apex",
      id: apexID,
      parents: alphas
    });

    return true;
  }

  spawnHybrid() {
    const filter = (species, speciesID) => {
      if (species === null) return false;
      return true;
    };

    const filtered = _.pickBy(this.species, filter);
    if (Object.keys(filtered).length < 2) {
      self.postMessage({
        event: "error",
        message: "Not enough candidates to spawn hybrid"
      });
      return false;
    }
    const speciesIDs = Object.keys(filtered);
    const parentOneSpeciesID = _.sample(speciesIDs);
    const parentTwoSpeciesID = _.sample(
      _.filter(speciesIDs, id => id != parentOneSpeciesID)
    );
    const hybridElite = this.createSpeciesByAlphaIDs(
      parentOneSpeciesID,
      parentTwoSpeciesID
    );
    const hybridID = this.spawnNetwork(hybridElite);
    self.postMessage({
      event: "hybrid",
      id: hybridID,
      parents: [parentOneSpeciesID, parentTwoSpeciesID]
    });
    return true;
  }

  save(key, value) {
    axios.post("http://localhost:8081/set/" + key, value);
  }

  async load(key) {
    const response = await axios.get("http://localhost:8081/get/" + key);
    return JSON.parse(response.data);
  }
}

let darwin;
self.onmessage = async message => {
  if (message.data.event == "initialize") {
    darwin = new Darwin();
  }
  if (message.data.event == "goes") {
    darwin.goes();
  }
};
