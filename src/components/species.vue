<template>
	<div>
		<div>
			<h2>Uber [{{uber.id}}: {{uber.age}}]</h2>
			<Graph :network="uber.network" :auto2D="auto2D" :auto3D="auto3D" />
		</div>
		<table id="current">
			<tr>
				<th>time</th>
				<td>{{prettyTime}}</td>
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
		<Scores :uberHistory="uberHistory" v-if="uberHistory.length > 0"/>
	</div>
</template>

<script>
import Vue from 'vue'
import prettyms from 'pretty-ms'

import Scores from "./scores.vue";
import Graph from "./graph.vue";

export default {
	name: "species",
	mixins: [],
	props: ["bus", "auto2D", "auto3D"],
	components: { Graph, Scores },
	data() {
		return {
			uberHistory: [],
			elapsedTime: 0,
			generation: 0,
			uber: {
				id: null,
				age: null,
				network: null
			},
			races: {}
		};
	},
	methods: {},
	computed: {
    prettyTime() {
      return prettyms(this.elapsedTime)
    }
  },
	created() {},
	mounted() {
		this.bus.$on("spawn", data => {
			Vue.set(this.races, data.id, {});
		});

		this.bus.$on("cull", data => {
			_.each(data.races, race => {
				delete this.races[race];
			});
		});

		this.bus.$on("uber", data => {
			this.uber.id = data.id;
			this.uber.age = data.age;
      this.uber.network = Object.freeze(data.network);
      this.uberHistory = data.history;
    });
    
    this.bus.$on('update', data => {
			Vue.set(this.races, data.id, Object.freeze(data.elite));
    })

    this.bus.$on('status', data => {
      console.log('ST', data)
			this.elapsedTime = data.elapsedTime;
			this.generation = data.generation;
    })
	}
};
</script>

<style>
</style>