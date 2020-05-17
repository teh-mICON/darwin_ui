<template>
	<div>
		<button @click="prev" value="prev">prev</button>
		<button @click="next" value="next">next</button>
		<div ref="graph2D" id="graph2D" class="graph_hide"></div>
	</div>
</template>

<script>
import Vue from "vue";
import ForceGraph3D from "3d-force-graph";
import vis from "vis-network";
import _ from "lodash";
import beautify from "json-beautify";
import format from "json-format-highlight";
import Converter from "hex2dec";
import Color from "color";

import utils from "../utils";

const NETVIS_COLORS = {
	input: "#333",
	hidden: "#111",
	action: "#777"
};

function normalize(low, high, value) {
	return (value - low) / (high - low);
}
function denormalize(low, high, value) {
	return +low + value * (high - low);
}

export default Vue.extend({
	name: "vis",

	props: ["network", "trace", "map", "auto2D", "auto3D"],
	data() {
		return {
			enabled2D: false,
			enabled3D: false,
			clickedEdge: null,
			clickedNode: null,
			visNetwork: undefined,
			current: 0
		};
	},

	mounted() {
		if (this.visNetwork !== undefined) {
			this.visNetwork.destroy();
			delete this.visNetwork;
		}
		this.render();
	},

	watch: {
		network() {
			this.render();
		},
		current() {
			this.render();
		}
	},

	methods: {
		next() {
			this.current++;
		},
		prev() {
			this.current--;
		},
		render() {
			if (this.auto2D) this.graph2D();
			if (this.auto3D) this.graph3D();
		},
		graph2D() {
			if (!this.network) return;
			this.enabled2D = true;
			this.render2D(this.$refs["graph2D"], this.network, this);
		},
		graph3D() {
			if (!this.network) return;
			this.enabled3D = true;
			this.render3D(this.$refs["graph3D"], this.network, this);
		},
		render2D: async (element, network, vue) => {
			if (vue.visNetwork !== undefined) {
				vue.visNetwork.destroy();
				delete vue.visNetwork;
			}

			const currentStep = vue.trace[vue.current];
				let currentNode, currentConnection;
			if (currentStep) {
				if (currentStep.event == "activation") {
					currentNode = vue.map[currentStep.node];
        } else if(currentStep.event == 'fire') {
          currentConnection = {from: vue.map[currentStep.connection.from], to: vue.map[currentStep.connection.to]};
        }
        console.log(currentStep)
			}

			element.classList.remove("graph_hide");
			element.classList.add("graph_show");
			//_.each(network.nodes, (node, index) => node.index = index);

			const nodesRaw = _.map(network.nodes, (node, index) => {
				let color;
				if (node.type == "input") color = NETVIS_COLORS.input;
				else if (node.type == "hidden") color = NETVIS_COLORS.input;
				else if (node.type == "output") color = NETVIS_COLORS.action;
				const connectionMapper = connection => {
					return {
						from: connection.from,
						to: connection.to,
						weight: connection.weight
					};
				};
				return {
					id: node.index,
					title: "" + node.index,
					label: "" + node.index,
					color: {
						background: currentNode == node.index ? "white" : color,
						border: currentNode == node.index ? "white" : color,
						text: "white",
						label: "white",
						highlight: "red"
					},
					custom: {
						id: node.index,
						type: node.type,
						output: node.activation,
						bias: node.bias,
						connections: _.map(network.connections, connectionMapper)
					}
				};
			});
			const nodes = new vis.DataSet(nodesRaw);

			const max = _.maxBy(network.connections, connection => connection.weight)
				.weight;
			const min = _.minBy(network.connections, connection => connection.weight)
				.weight;
			const edgesRaw = network.connections.map(connection => {
				const normalized = normalize(min, max, connection.weight);
        const width = denormalize(1, 10, normalized);
        let color;
        if(currentConnection && connection.from == currentConnection.from && connection.to == currentConnection.to) {
          color = "white"
        } else {
          color = connection.type == "excite" ? "#333" : "#aaa"
        }
				return {
					from: connection.from,
					to: connection.to,
					width,
					arrows: "to",
					color,
					custom: { connection }
				};
			});
			const edges = new vis.DataSet(_.remove(edgesRaw, edge => edge !== null));

			const options = {
				autoResize: true,
				height: "800px",
				width: "100%",
				edges: {
					smooth: {
						type: "cubicBezier",
						forceDirection: "vertical"
					}
				},
				layout: {
					hierarchical: {
						direction: "UD",
						sortMethod: "directed"
					}
				},
				physics: false
			};

			vue.visNetwork = new vis.Network(element, { nodes, edges }, options);

			vue.visNetwork.on("click", properties => {
				const nodeIDs = properties.nodes;
				const node = nodes.get(nodeIDs)[0];

				const edgeIDs = properties.edges;
				const edge = edges.get(edgeIDs)[0];

				if (node && node.custom) {
					vue.clickedNode = format(beautify(node.custom, null, 2, 100));
				} else {
					vue.clickedNode = "";
				}
				if (edge && edge.custom && edge.custom.connection) {
					vue.clickedEdge = format(
						beautify(edge.custom.connection, null, 2, 100)
					);
				} else {
					vue.clickedEdge = "";
				}
			});
		},

		async render3D(element, network, vue) {
			element.classList.remove("graph_hide");
			element.classList.add("graph_show");
			const max = _.maxBy(network.connections, connection => connection.weight)
				.weight;
			const min = _.minBy(network.connections, connection => connection.weight)
				.weight;

			const gData = {
				nodes: _.map(network.nodes, node => ({
					id: node.index,
					type: node.type
				})),
				links: _.map(network.connections, connection => {
					const normalized = normalize(min, max, connection.weight);
					const width = denormalize(1, 3, normalized);
					return {
						source: connection.from.index,
						target: connection.to.index,
						weight: connection.weight,
						width
					};
				})
			};
			const Graph = ForceGraph3D()(element)
				.graphData(gData)
				.linkDirectionalArrowLength(3.5)
				.linkDirectionalArrowRelPos(1)
				.linkCurvature(0.25)
				.linkColor(link => {
					return link.weight > 0 ? "green" : "red";
				})
				.nodeColor(node => {
					if (node.type == "input") return NETVIS_COLORS.input;
					if (node.type == "hidden") return NETVIS_COLORS.hidden;
					if (node.type == "action") return NETVIS_COLORS.action;
					return "#ff0000";
				})
				.linkWidth(node => node.width)
				.height(500)
				.backgroundColor("black");
		}
	}
});
</script>

<style>
.json_small {
	font-size: 14px;
	background-color: #111;
}
#graph2D {
	background-color: black;
}
#graph3D {
	height: 500px;
}
.graph_show {
	display: block;
}
.graph_hide {
	display: none;
}
</style>
