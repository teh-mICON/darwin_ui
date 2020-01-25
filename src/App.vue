<template>
	<div>
		<div id="main_container">
			<div class="d-flex flex-row flexatron">
				<World :width="width" :height="height" />
				<div id="species">
					<ul class="nav nav-tabs" id="species">
						<li class="nav-item">
							<span
								:class="'nav-link' + (selectedSpecies == 'carrot' ? ' active' : '')"
								@click="selectSpecies('carrot')"
							>carrot</span>
						</li>
						<li class="nav-item">
							<span
								:class="'nav-link' + (selectedSpecies == 'sonic' ? ' active' : '')"
								@click="selectSpecies('sonic')"
							>sonic</span>
						</li>
						<li class="nav-item">
							<span
								:class="'nav-link' + (selectedSpecies == 'single' ? ' active' : '')"
								@click="selectSpecies('single')"
							>single</span>
						</li>
						<li class="nav-item">
							<span
								:class="'nav-link' + (selectedSpecies == 'human' ? ' active' : '')"
								@click="selectSpecies('human')"
							>human</span>
						</li>
					</ul>
					<!--<Species
						species="carrot"
						:class="carrotClass"
						:bus="busses.carrot"
						:auto2D="auto2D"
					/>
					<Species
						species="sonic"
						:class="sonicClass"
						:bus="busses.sonic"
						:auto2D="auto2D"
					/>-->
					<Species
						species="single"
						:class="singleClass"
						:bus="busses.single"
					/>
					<Human v-if="selectedSpecies == 'human'" :class="humanClass"/>
				</div>
			</div>
			<div>
				<div id="content">
					<div class="d-flex flex-row flexatron">
						<div class="control">
							<div
								v-for="(item, index) in config.inputs"
								:key="'input_left_' + index"
								class="input-group input-group-sm"
							>
								<div class="input-group-prepend" v-tooltip.left="item.tooltip">
									<span class="input-group-text">{{item.caption}}</span>
								</div>
								<input type="text" class="form-control" v-input-model="'vizconfig_' + index" />
							</div>
						</div>
						<div class="control">
							<div class="form-group">
								<div class="custom-control custom-switch">
									<input type="checkbox" class="custom-control-input" id="autoswitch2d" v-model="auto2D" />
									<label class="custom-control-label" for="autoswitch2d">auto render 2D</label>
								</div>
								<div class="custom-control custom-switch">
									<input type="checkbox" class="custom-control-input" id="autoswitch3d" v-model="auto3D" />
									<label class="custom-control-label" for="autoswitch3d">auto render 3D</label>
								</div>
							</div>
						</div>
					</div>
					<div class="d-flex flex-row flexatron">
						<div class="input-group special">
							<div class="input-group-prepend">
								<button @click="reset('carrot')" class="btn btn_red" type="button">reset carrot</button>
								<button @click="reset('sonic')" class="btn btn_red" type="button">reset sonic</button>
								<button @click="reset('single')" class="btn btn_red" type="button">reset single</button>
							</div>
						</div>
					</div>
					<div class="btn-group" role="group"></div>
				</div>
			</div>
		</div>
	</div>
</template>

<script>
import _ from "lodash";
import axios from "axios";

import Vue from "vue";
import Graph from "./components/graph.vue";
import Scores from "./components/scores.vue";
import World from "./components/world.vue";
import Human from "./components/human.vue";
import Species from "./components/species.vue";

import utils from "./utils";

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
	inputs: {
		generationTime: {
			caption: "generationTime",
			tooltip: "the time before a new generation is spawned",
			default: 1000 * 60 * 3
		},
		raceCount: {
			caption: "raceCount",
			tooltip: "how many races in parallel?",
			default: 12
		}
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
_.each(config.inputs, (item, name) => wrap(name, item.default));
wrap("autorun", false, false, value => JSON.parse(value));
wrap("auto2D", false, false, value => JSON.parse(value));
wrap("auto3D", false, false, value => JSON.parse(value));

export default Vue.extend({
	name: "app",

	components: {
		Graph,
		Scores,
		World,
		Human,
		Species
	},

	data() {
		this.speciesWorker = null;
		this.speciesWorkerModule = null;
		this.busses = {
			carrot: new Vue(),
      sonic: new Vue(),
      single: new Vue()
		};
		return {
			selectedSpecies: "single",
			width: 200,
			height: 200,
      initialized: 0,
			config,
      ...dataItems
		};
	},
	watch: {
		...watchItems
  },
  computed: {
    generationTime() {
      return this.vizconfig_generationTime;
    },
    raceCount() {
      return this.vizconfig_raceCount;
    },

    carrotClass() {
      if(this.initialized == 2) return this.selectedSpecies == 'carrot' ? 'activeSpecies' : 'inactiveSpecies';
    },
    sonicClass() {
      if(this.initialized == 2) return this.selectedSpecies == 'sonic' ? 'activeSpecies' : 'inactiveSpecies';
    },
    singleClass() {
      if(this.initialized == 2) return this.selectedSpecies == 'single' ? 'activeSpecies' : 'inactiveSpecies';
    },
    humanClass() {
      if(this.initialized == 2) return this.selectedSpecies == 'human' ? 'activeSpecies' : 'inactiveSpecies';
    },
  },

	async created() {
		document.title = "darwin UI";
		this.speciesWorkerModule = await import("worker-loader!./workers/species.js");
		this.startSpeciesWorker();
		if (this.autorun) {
			window.setTimeout(() => {
				this.run();
			}, 1000);
    }
	},
	methods: {
		selectSpecies(species) {
      this.selectedSpecies = species;
		},
		toast(type, species, message) {
			this.$toasted.show("(" + species + ") " + message, {
				type,
				duration: 8000
			});
		},

		forwardToSpecies(message) {
			try {
				this.busses[message.data.species].$emit(
					message.data.event,
					message.data
				);
			} catch (error) {
        console.log("failed to emit message", message);
        console.error(error)
			}
		},

		msg_spawn(message) {
			this.toast(
				"success",
				message.data.species,
				"* Spawned race: " + message.data.id
			);
			this.forwardToSpecies(message);
		},

		msg_cull(message) {
			this.toast(
				"success",
				message.data.species,
				"💀 Culled races: " + message.data.culled
			);
			this.forwardToSpecies(message);
		},

		msg_apex(message) {
			this.toast(
				"success",
				message.data.species,
				"☝️ Apex race created: " +
					message.data.parents +
					" -> " +
					message.data.id
			);
			this.forwardToSpecies(message);
		},

		msg_hybrid(message) {
			this.toast(
				"success",
				message.data.species,
				"-><- Hybrid race created: " + message.data.parents
			);
			this.forwardToSpecies(message);
		},

		msg_uber(message) {
			this.toast(
				"success",
				message.data.species,
				"🔝 uber: " + message.data.age
			);
			this.forwardToSpecies(message);
		},

		msg_elite(message) {
			this.forwardToSpecies(message);
		},

		msg_update(message) {
			this.forwardToSpecies(message);
		},

		msg_error(message) {
			this.toast("error", message.data.species, message.data.message);
    },

    msg_reset(message) {
      this.toast("info", message.data.species, message.data.message);
      window.setTimeout(() => {
        window.location = window.location;
      }, 2000)
    },

		msg_status(message) {
			this.forwardToSpecies(message);
    },

    msg_trace(message) {
      this.forwardToSpecies(message);
    },
    
    msg_ready(message) {
      this.initialized++;
    },

		startSpeciesWorker(name) {
			if (this.speciesWorker) {
				this.speciesWorker.terminate();
			}

			const worker = (this.speciesWorker = this.speciesWorkerModule.default());

			// worker incoming message handling
			worker.onmessage = message => {
				const method = "msg_" + message.data.event;
        const handler = this[method].bind(this);
				handler(message);
			};

			// initialize worker
			worker.postMessage({
				event: "initialize"
			});
    },
    
    reset(species) {
      // send reset to species worker and reset after 1s
      this.speciesWorker.postMessage({
        event: 'reset',
        species,
        raceCount: this.raceCount,
        generationTime: this.generationTime
      })
    },

		async save(key, value, checkParse = false) {
			const url = "http://localhost:8001/set/" + key;
			await axios.post(url, { value });
		},

		async load(key) {
			let response;
			try {
				response = await axios.get(
					"http://localhost:8001/get/" + key
				);
			} catch (error) {
				console.log("ERROR REQUESTING", key);
				throw error;
			}

			try {
				const parsed = JSON.parse(response.data);
				return parsed.value;
			} catch (error) {
				console.log("ERROR PARSING", key, "FROM DB");
				console.log(response.data);
				throw error;
			}
		}
	},
	beforeDestroy() {
		if (this.speciesWorker) {
			this.speciesWorker.terminate();
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
	& > * {
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
.nav-link {
	color: white;
	cursor: pointer;
}

#species {
	flex: 10;
}
.inactiveSpecies {
	display: none;
}
</style>
