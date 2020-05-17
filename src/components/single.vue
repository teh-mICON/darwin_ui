<template>
	<div>
		<div>
			<h2>Uber [{{uber.id}}: {{uber.age}}]</h2>
			<Graph :network="network" :map="map" :trace="trace" :auto2D="true" :auto3D="true" />
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
    {{trace}}
		<Scores :uberHistory="uberHistory" v-if="uberHistory.length > 0"/>
	</div>
</template>

<script>
import Vue from 'vue'
import prettyms from 'pretty-ms'

import Scores from "./scores.vue";
import Graph from "./graphsonic.vue";

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
      network: null,
			uber: {
				id: null,
				age: null,
				network: null
			},
      races: {},
      trace: [],
      map: {}
		};
	},
	methods: {
    setNetwork(sonic) {
      const map = {};
      const nodes = [];
      const connections = [];
      _.each(sonic.nodes, (node, index) => {
        map[node.id] = index;
      });

      _.each(sonic.nodes, node => {
        node.index = map[node.id];
        nodes.push(node);
        _.each(node.connections, connection =>  {
          connection.from = map[connection.from];
          connection.to = map[connection.to];
          connection.weight = connection.type == 'excite' ? 1 : -1;
          connections.push(connection)
        })
      })

      this.network = {nodes, connections}
      this.map = map
      console.log(this.network)
    },
    addNode(node, nodes, connections) {
      nodes[node.id] = node;
      _.each(node.connections, connection => {
        console.log(connection)
        //connections[connection.from + '_' + connection.to] = connection;
      })
    }
  },
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
      this.setNetwork(data.network);
      //this.uber.network = Object.freeze(data.network);
      this.uberHistory = data.history;
    });
    
    this.bus.$on('update', data => {
			Vue.set(this.races, data.id, Object.freeze(data.elite));
    })

    this.bus.$on('status', data => {
			this.elapsedTime = data.elapsedTime;
			this.generation = data.generation;
    })

    this.bus.$on('trace', data => {
			this.trace = data.trace;
    })
	}
};
</script>

<style>
</style>