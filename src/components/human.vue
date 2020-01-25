<template>
	<div id="human">
		<input
			type="text"
			@keydown="humanControl"
			id="human_control"
			@focus="initHuman"
			@blur="destroyHuman"
		/>
		<span id="human_cooords" class="human_indicator">{{human.x}} : {{human.y}}</span>
		<span id="human_food" class="human_indicator">{{human.food}}</span>
		<span id="human_water" class="human_indicator">{{human.water}}</span>
		<span id="human_energy" class="human_indicator">{{human.energy}}</span>
		<span id="human_age" class="human_indicator">{{human.age}}</span>
	</div>
</template>

<script>
export default {
  name: 'human',
	mixins: [],
	props: [],
	data() {
		this.humanWorkerModule = null;
		this.humanWorker = null;
		return {
			human: {
				x: 0,
				y: 0,
				food: "",
				water: "",
				energy: "",
				age: ""
			},

    };
	},
	methods: {
		initHuman() {
			// launch worker
			this.humanWorker = this.humanWorkerModule.default();
			this.humanWorker.onmessage = message => {
				const creature = message.data.creature;
				this.human.x = creature.x;
				this.human.y = creature.y;
				this.human.food = _.repeat("|", Math.floor(creature.food));
				this.human.water = _.repeat("|", Math.floor(creature.water));
				this.human.energy = _.repeat("|", Math.floor(creature.energy / 10));
				this.human.age = creature.age;
			};
		},
		destroyHuman() {
			this.humanWorker.terminate();
		},
		humanControl(event) {
			event.preventDefault();
			this.humanWorker.postMessage({
				key: event.keyCode
			});
		},

  },
	computed: {},
	async created() {
		this.humanWorkerModule = await import("worker-loader!../workers/human.js");

  },
	mounted() {}
};
</script>

<style>
#human {
  width: 250px;
  flex: 1;
}
#human_control {
  width: 100%;
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