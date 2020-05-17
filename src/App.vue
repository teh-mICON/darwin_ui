<template>
	<div>
		<div id="main_container">
			<div>
				<World :width="width" :height="height" />
				<div class="d-flex flex-row flexatron">
					<Scores :scores="hiscores" v-if="hiscores.length > 1" />
					<Scores :scores="generationHiscores" v-if="generationHiscores.length > 1" />
					<Scores :scores="intergenerationHiscores" v-if="intergenerationHiscores.length > 1" />
				</div>
			</div>
			<div>
				<div id="content">
					<div class="d-flex flex-row flexatron">
						<div class="input-group special">
							<div class="input-group-prepend">
								<button @click="reset()" class="btn btn_red" type="button">RESET</button>
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

import utils from "./utils";

let { Network } = require("@liquid-carrot/carrot");

export default Vue.extend({
	name: "app",

	components: {
		Graph,
		Scores,
		World
	},

	data() {
		this.speciesWorker = null;
		this.speciesWorkerModule = null;
		this.socket = null;
		return {
			width: 200,
			height: 200,
      initialized: 0,
      generation: 0,
      hiscore: 0,
      hiscores: [],
      generationHiscore: 0,
      generationHiscores: [],
      interngenerationHiscore: 0,
			intergenerationHiscores: []
		};
	},

	async created() {
		document.title = "darwin UI";
		this.initSocket();
	},
	methods: {
		toast(type, message) {
			this.$toasted.show(message, {
				type,
				duration: 8000
			});
		},

		msg_death(msg) {},

		msg_generation(msg) {
			this.scoresGeneration = [{ age: this.max, generation: this.generation }];
			this.scoresHistory.push({
				age: this.maxGeneration,
				generation: this.generation
			});
			this.maxGeneration = 0;
			this.toast("info", "New generation: " + msg.generation);
		},

		msg_scores(msg) {
      console.log(msg);
      this.generation = msg.generation;
      this.hiscore = msg.hiscore;
      this.hiscores = msg.hiscores;
      this.generationHiscore = msg.generationHiscore;
      this.generationHiscores = _.map(msg.generationHiscores, score => score);
      this.intergenerationHiscore = msg.intergenerationHiscore;
      this.intergenerationHiscores = msg.intergenerationHiscores;
		},

		initSocket() {
      const port = +window.location.search.substring(1) +2;
			this.socket = new WebSocket("ws://localhost:" + port);
			this.socket.onmessage = message => {
				const msg = JSON.parse(message.data);
				const method = "msg_" + msg.event;
				const handler = this[method].bind(this);
				handler(msg);
			};
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
				handler(message.data);
			};

			// initialize worker
			worker.postMessage({
				event: "initialize"
			});
		},

		reset(species) {
			// send reset to species worker
			this.speciesWorker.postMessage({
				event: "reset",
				species,
				config: {
					raceCount: this.raceCount,
					generationTime: this.generationTime,
					elitePerRace: this.elitePerRace,
					wildcardPerRace: this.wildcardPerRace,
					cullPerGen: this.cullPerGen
				}
			});
		},

		async save(key, value, checkParse = false) {
      const port = +window.location.search.substring(1) +1;
			const url = "http://localhost:" + port + "/set/" + key;
			await axios.post(url, { value });
		},

		async load(key) {
			let response;
			try {
      const port = +window.location.search.substring(1) +1;
				response = await axios.get("http://localhost:" + port + "/get/" + key);
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
body h2,
body h3 {
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
