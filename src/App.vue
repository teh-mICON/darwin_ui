<template>
	<div>
		<div id="main_container">
			<World
				:currentSpecies="currentSpecies.id"
				:uberSpecies="uber.id"
				:width="width"
				:height="height"
			/>
			<div id="human">
				<input type="text" @keydown="humanControl" id="human_control" />
				<span id="human_food" class="human_indicator">{{human.food}}</span>
				<span id="human_water" class="human_indicator">{{human.water}}</span>
				<span id="human_energy" class="human_indicator">{{human.energy}}</span>
				<span id="human_age" class="human_indicator">{{human.age}}</span>
			</div>
			<div>
				<div>
					<h2>Uber [{{uber.id}}: {{uber.age}}]</h2>
					<Graph :network="uber.network" :auto2D="auto2D" :auto3D="auto3D" />
				</div>
				<div v-if="currentSpecies.id">
					<h2>Selected [{{currentSpecies.id}}: {{currentSpecies.age}}]</h2>
					<Graph :network="currentSpecies.network" :auto2D="auto2D" :auto3D="auto3D" />
				</div>
				<div class="input-group special">
					<div class="input-group-prepend">
						<button
							@click="setCurrentSpecies(index)"
							class="btn btn_blue"
							type="button"
							v-for="(data, index) in species"
							:key="index"
						>{{index}}</button>
					</div>
				</div>
				<div id="content">
					<div class="d-flex flex-row flexatron">
						<div class="controls">
							<div
								v-for="(item, index) in config.inputsLeft"
								:key="'input_left_' + index"
								class="input-group input-group-sm"
							>
								<div class="input-group-prepend" v-tooltip.right="item.tooltip">
									<span class="input-group-text">{{item.caption}}</span>
								</div>
								<input type="text" class="form-control" v-input-model="'vizconfig_' + index" />
							</div>
						</div>
						<div class="controls">
							<div
								v-for="(item, index) in config.inputsRight"
								:key="'input_left_' + index"
								class="input-group input-group-sm"
							>
								<div class="input-group-prepend" v-tooltip.left="item.tooltip">
									<span class="input-group-text">{{item.caption}}</span>
								</div>
								<input type="text" class="form-control" v-input-model="'vizconfig_' + index" />
							</div>
						</div>
					</div>
					<div class="d-flex flex-row flexatron">
						<div class="btn-group" role="group" aria-label="Basic example">
							<button
								v-for="(buttonConfig, name) in config.workers"
								:key="'button_' + name"
								:class="['btn', workerClass == name ? 'btn_blue_active' : 'btn_blue']"
								@click="setWorker(name)"
							>{{name}}</button>
						</div>
						<div class="input-group special">
							<div class="input-group-prepend">
								<button @click="goes()" class="btn btn_green" type="button">{{goescaption}}</button>
								<button @click="reset()" class="btn btn_red" type="button">reset</button>
							</div>
						</div>
						<div class="form-group">
							<div class="custom-control custom-switch">
								<input type="checkbox" class="custom-control-input" id="autoswitch2d" v-model="auto2D" />
								<label class="custom-control-label" for="autoswitch2d">auto render 2D</label>
							</div>
							<div class="custom-control custom-switch">
								<input type="checkbox" class="custom-control-input" id="autoswitch3d" v-model="auto3D" />
								<label class="custom-control-label" for="autoswitch3d">auto render 3D</label>
							</div>
							<div class="custom-control custom-switch">
								<input type="checkbox" class="custom-control-input" id="autogoes" v-model="autogoes" />
								<label class="custom-control-label" for="autogoes">auto goes</label>
							</div>
						</div>
					</div>
					<div class="d-flex flex-row flexatron">
						<table id="result">
							<tr v-for="(result, index) in results" :key="index">
								<td class="input">{{result.input.join(',')}}</td>
								<td class="ideal">{{result.output.join(',')}}</td>
								<td class="actual">{{result.actual.join(' ')}}</td>
							</tr>
						</table>
						<table id="current">
							<tr>
								<th>time</th>
								<td>{{elapsedTime / 1000}}s</td>
							</tr>
							<tr>
								<th>generation</th>
								<td>{{generation}}</td>
							</tr>
							<tr>
								<th>score</th>
								<td>{{uber.age}}</td>
							</tr>
						</table>
					</div>
					<div class="btn-group" role="group"></div>
					<Scores :scores="scores" v-if="scores" />
					<!--<h2>History</h2>
      <div v-for="(event, index) in events" :key="index">
        <div v-if="event.event == 'move' || event.event == 'turn'">
          {{event.event}}: {{event.direction}}
        </div>
        <div v-else>
          {{event}}
        </div>
					</div>-->
					<!--<Genome :network="network" v-if="network" />-->
				</div>
			</div>
		</div>
	</div>
</template>

<script>
import _ from "lodash";

import Vue from "vue";
import Graph from "./components/graph.vue";
import GenomeComponent from "./components/genome.vue";
import Scores from "./components/scores.vue";
import World from "./components/world.vue";

import utils from "./utils";
import axios from "axios";

let { Network } = require("@liquid-carrot/carrot");

Vue.directive("input-model", {
	bind: function(element, binding, vnode) {
		element.value = vnode.context[binding.value];
		element.onchange = () => {
			vnode.context[binding.value] = element.value;
		};
	}
});

const config = {
	inputsLeft: {
		goestimes: {
			caption: "X",
			tooltip: "maximum samples to feed the network",
			default: 100000
		},
		cutoff: {
			caption: "cutoff",
			tooltip: "the minimum error at which to stop learning",
			default: 0.001
		},
		updateInterval: {
			caption: "update interval",
			tooltip: "the amount of learning examples before updating the viz",
			default: 1000
		}
	},
	inputsRight: {
		learningRate: {
			caption: "learning rate",
			tooltip: "the multiplier applied to weight updates",
			default: 0.01
		}
	},
	workers: {
		darwin: {}
	}
};

// reactive local storage wrapper
const dataItems = {};
const watchItems = {};
const wrap = (name, default_, prefix = true, transform = null) => {
	if (prefix) name = "vizconfig_" + name;
	if (localStorage.getItem(name) === null) {
		dataItems[name] = default_;
	} else {
		if (transform !== null) {
			dataItems[name] = transform(localStorage.getItem(name));
		} else {
			dataItems[name] = localStorage.getItem(name);
		}
	}
	watchItems[name] = value => {
		localStorage.setItem(name, value);
	};
};
_.each(config.inputsLeft, (item, name) => wrap(name, item.default));
_.each(config.inputsRight, (item, name) => wrap(name, item.default));
wrap("activeWorker", Object.keys(config.workers)[0], false);
wrap("autogoes", false, false, value => JSON.parse(value));
wrap("auto2D", false, false, value => JSON.parse(value));
wrap("auto3D", false, false, value => JSON.parse(value));

export default Vue.extend({
	name: "app",

	components: {
		Graph,
		Genome: GenomeComponent,
		Scores,
		World
	},

	data() {
		return {
			currentSpecies: {
				id: null,
				network: null,
				age: null
			},
			species: {},
			results: [],
			uber: {
				id: null,
				age: null,
				network: null
			},
			human: {
				food: "",
				water: "",
				energy: "",
				age: ""
			},
			uberHistory: [],
			scores: [],
			genome: null,
			humanWorker: null,
			worker: null,
			score: 0,
			epoch: 0,
			startTime: new Date(),
			elapsedTime: 0,
			generation: 0,
			status: "idle",
			goescaption: "goes",
			width: 200,
			height: 200,
			config,
			workerClass: null, // for button class reactivity
			...dataItems
		};
	},
	watch: {
		...watchItems
	},

	async created() {
		document.title = "nn-viz";

		this.setWorker("darwin");
		this.initHuman();
	},
	methods: {
		initHuman() {
			const path = import("worker-loader!./workers/human.js").then(worker => {
				// launch worker
				this.humanWorker = worker.default();
				this.humanWorker.onmessage = message => {
					const creature = message.data.creature;
					this.human.food = _.repeat("|", Math.floor(creature.food));
					this.human.water = _.repeat("|", Math.floor(creature.water));
          this.human.energy = _.repeat("|", Math.floor(creature.energy / 10));
          this.human.age = creature.age;
				};
			});
		},
		humanControl(event) {
			event.preventDefault();
			this.humanWorker.postMessage({
				key: event.keyCode
			});
		},
		toast(type, message) {
			this.$toasted.show(message, { type, duration: 3000 });
		},

		msg_spawn(message) {
			this.toast("success", "* Spawned species: " + message.data.id);
			Vue.set(this.species, message.data.id, {});
		},

		msg_cull(message) {
			this.toast("success", "💀 Culled species: " + message.data.species);
			_.each(message.data.species, species => {
				delete this.species[species];
			});
		},

		msg_apex(message) {
			this.toast(
				"success",
				"☝️ Apex species created: " +
					message.data.parents +
					" -> " +
					message.data.id
			);
		},

		msg_hybrid(message) {
			this.toast(
				"success",
				"-><- Hybrid species created: " + message.data.parents
			);
		},

		msg_uber(message) {
			this.toast("success", "🔝 uber: " + message.data.age);

			this.uber.id = message.data.id;
			this.uber.age = message.data.age;
			this.uber.network = Object.freeze(message.data.network);

			// empty and refill scores array
			while (this.scores.length) {
				this.scores.splice(0, 1);
			}
			_.each(message.data.history, step => {
				this.scores.push(step.age);
			});
		},

		msg_elite(message) {
			// toast the message details
			this.toast(
				"success",
				`[👑: ${message.data.id}] elite replace: ${message.data.eliteLevel}: ${message.data.age}`
			);
		},

		msg_update(message) {
			Vue.set(this.species, message.data.id, Object.freeze(message.data.elite));
		},

		msg_error(message) {
			this.toast("error", message.data.message);
		},

		msg_status(message) {
			this.elapsedTime = message.data.elapsedTime;
			this.generation = message.data.generation;
		},

		setWorker(name) {
			const ctx = this;
			if (this.worker) {
				this.worker.terminate();
			}

			this.activeWorker = name;
			this.workerClass = name;

			// import worker
			const path = import("worker-loader!./workers/" + name + ".js").then(
				worker => {
					// launch worker
					this.worker = worker.default();

					// worker incoming message handling
					this.worker.onmessage = message => {
						const handler = this["msg_" + message.data.event].bind(this);
						handler(message);
					};

					// initialize worker
					this.worker.postMessage({
						event: "initialize",
						config: config.workers[name]
					});

					// goes?
					if (this.autogoes) this.goes();
				}
			);
		},

		async goes() {
			switch (this.status) {
				case "idle":
					this.status = "running";
					this.goescaption = "pause";

					// create event config
					const goesConfig = {
						event: "goes"
					};
					// add configurations of input elements
					const addToConfig = name => {
						goesConfig[name] = this["vizconfig_" + name];
					};
					_.each(config.inputsLeft, (item, name) => addToConfig(name));
					_.each(config.inputsRight, (item, name) => addToConfig(name));

					// post to worker
					this.worker.postMessage({
						event: "goes",
						...goesConfig
					});
					this.startTime = new Date();
					break;
				case "running":
					this.worker.postMessage({
						event: "pause"
					});
					this.status = "paused";
					this.goescaption = "resume";
					break;
				case "paused":
					this.status = "running";
					this.goescaption = "pause";
					this.worker.postMessage({
						event: "resume"
					});
					break;
			}
		},
		save(key, value) {
			axios.post("http://localhost:8081/set/" + key, value);
		},

		async load(key) {
			const response = await axios.get("http://localhost:8081/get/" + key);
			return JSON.parse(response.data);
		},

		buttonClass(name) {
			if (name == this.activeWorker) return "btn btn-info";
			return "btn btn-secondary";
		},
		reset() {
			axios.get("http://localhost:8081/reset");
			window.location = window.location;
		}
	},
	beforeDestroy() {
		if (this.worker) {
			this.worker.terminate();
		}
	}
});
</script>

<style lang="scss">
html body {
	background-color: #0c0c0c;
	color: #eee;
}
#content {
	padding: 20px;
}
input[type="text"] {
	background-color: black;
	color: #ddd;
	border: 0;
}
html pre {
	color: #eee;
}
.flexatron {
	margin-bottom: 10px;
	& > * {
		margin-right: 20px;
		flex: 1;
	}
}
#result {
	font-family: "Consolas";
	td {
		border: 1px solid #333;
		padding: 5px;
	}
	.input {
		color: yellow;
	}
	.output {
		color: #aaa;
	}
	.result {
		color: white;
	}
}
#trend {
	margin-bottom: 20px;
}
html .btn {
	padding: 10px;
}
html .btn-secondary {
	background-color: black;
	color: white;
}
html .input-group-text {
	width: 150px;
	background-color: black;
	color: white;
	border-right: 1px solid white;
}
.btn-group.special {
	display: flex;
}
.special .btn {
	flex: 1;
}
#current td {
	padding-left: 15px;
}

.tooltip {
	display: block !important;
	z-index: 10000;
	.tooltip-inner {
		background: #333;
		color: white;
		border-radius: 5px;
		padding: 5px 10px 4px;
		border-bottom: 3px solid #46828d;
	}
	&[x-placement^="right"] {
		margin-left: 5px;
		.tooltip-arrow {
			border-width: 5px 5px 5px 0;
			border-left-color: transparent !important;
			border-top-color: transparent !important;
			border-bottom-color: transparent !important;
			left: -5px;
			top: calc(50% - 5px);
			margin-left: 0;
			margin-right: 0;
		}
	}
	&[x-placement^="left"] {
		margin-right: 5px;
		.tooltip-arrow {
			border-width: 5px 0 5px 5px;
			border-top-color: transparent !important;
			border-right-color: transparent !important;
			border-bottom-color: transparent !important;
			right: -5px;
			top: calc(50% - 5px);
			margin-left: 0;
			margin-right: 0;
		}
	}
	&[aria-hidden="true"] {
		visibility: hidden;
		opacity: 0;
		transition: opacity 0.15s, visibility 0.15s;
	}
	&[aria-hidden="false"] {
		visibility: visible;
		opacity: 1;
		transition: opacity 0.15s;
	}
}

html .btn_green {
	background-color: #506e50;
	color: white;
}
html .btn_blue {
	background-color: #505e6e;
	color: white;
}
html .btn_blue_active {
	background-color: lighten(#505e6e, 20%);
	color: white;
}
html .btn_red {
	background-color: #6e5050;
	color: white;
}
html .btn_outline_green {
	border: 2px solid #506e50;
	color: white;
}
body h2 {
	color: #ddd;
}
#main_container {
	display: flex;
}
#human {
	border: 1px solid red;
}
.human_indicator {
	display: block;
}
#human_water {
	color: blue;
}
#human_food {
	color: brown;
}
#human_energy {
	color: green;
}
#human_control {
	border: 1px solid white;
  color: transparent;
}
#human_control:focus {
	outline: none;
  background: white;
}
</style>
