<template>
	<div id="world_container">
		<div v-if="edit">
			<button @click="setTile('water')" id="tile_water"></button>
			<button @click="setTile('tree')" id="tile_tree"></button>
			<button @click="setTile('hive')" id="tile_hive"></button>
			<button @click="setTile('mountain')" id="tile_mountain"></button>
			<button @click="setTile('remove')" id="tile_remove"></button>
		</div>
		<canvas
			id="world"
			:width="width*tileSize"
			:height="height*tileSize"
			ref="world"
			@mousedown="startSend"
			@mouseup="stopSend"
			@mousemove="move"
		></canvas>
		<div v-if="oldest !== null" class="oldest">
			Oldest: {{oldest.speciesID}}/{{oldest.id}} : {{oldest.age}}
			<br />
			Actions: {{Math.round(oldest.actions)}}
			<br />
			APM: {{Math.round(oldest.apm)}}
			<br />Energy:
			<span class="energy">{{pipes(oldest.energy)}}</span>
			<br />Food:
			<span class="food">{{pipes(oldest.food)}}</span>
			<br />Water:
			<span class="water">{{pipes(oldest.water)}}</span>
			<br />
			<span class="energy">{{Math.round(oldest.energy)}}</span> ::
			<span class="food">{{Math.round(oldest.food)}}</span> ::
			<span class="water">{{Math.round(oldest.water)}}</span>
		</div>
	</div>
</template>

<script>
import axios from "axios";
import randomcolor from "randomcolor";

const tileSize = 4;

export default {
	mixins: [],
	props: ["selectedRace", "uberRace", "width", "height"],
	data() {
		return {
			oldest: null,
			type: null,
			send: false,
			tileSize,
			raceColors: {},
			edit: false,
			grid: false
		};
	},
	methods: {
		pipes(num) {
			if (Math.round(num) > 0) return "|".repeat(Math.round(num));
		},
		setTile(type) {
			this.type = type;
		},
		startSend(event) {
			this.send = true;
			this.addTile(event);
		},
		stopSend() {
			this.send = false;
		},
		move(event) {
			this.addTile(event);
		},
		xy(event) {
			const canvas = this.$refs.world;
			const rect = canvas.getBoundingClientRect();
			const x = Math.floor((event.clientX - rect.left) / tileSize);
			const y = Math.floor((event.clientY - rect.top) / tileSize);
			console.log(x, y);
		},
		addTile(event) {
			if (!this.send) return;
			if (!this.type) return;
			const canvas = this.$refs.world;
			const rect = canvas.getBoundingClientRect();
			const x = Math.floor((event.clientX - rect.left) / tileSize);
			const y = Math.floor((event.clientY - rect.top) / tileSize);
			const port = +window.location.search.substring(1) + 3;
			if (this.type == "remove") {
				axios
					.get("http://localhost:" + port + "/remove_tile?x=" + x + "&y=" + y)
					.then(() => {});
			} else {
				axios
					.get(
						"http://localhost:" +
							port +
							"/add_tile?x=" +
							x +
							"&y=" +
							y +
							"&type=" +
							this.type
					)
					.then(() => {});
			}
		},
		getCreatureColor(raceID) {
			if (this.raceColors[raceID] === undefined) {
				this.raceColors[raceID] = randomcolor();
			}
			return this.raceColors[raceID];
		},
		loop() {
			setTimeout(() => {
				this.loop();
			}, 50);

			const canvas = this.$refs.world;
			if (!canvas) return;
			const ctx = canvas.getContext("2d");

			const port = +window.location.search.substring(1) + 3;
			axios.get("http://localhost:" + port + "/world").then(result => {
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				const width = 200;
				const height = 200;
				if (this.grid) {
					// draw grid
					_.each(_.range(1, width), x => {
						ctx.beginPath();
						ctx.moveTo(x * tileSize, 0);
						ctx.lineTo(x * tileSize, width * tileSize);
						ctx.strokeStyle = "gray";
						ctx.stroke();
						ctx.closePath();
					});
					_.each(_.range(1, height), y => {
						ctx.beginPath();
						ctx.moveTo(0, y * tileSize);
						ctx.lineTo(height * tileSize, y * tileSize);
						ctx.strokeStyle = "gray";
						ctx.stroke();
						ctx.closePath();
					});
				}

				// find oldest
				const creatures = _.filter(
					result.data,
					tile => tile.type == "creature"
				);
				if (creatures.length) {
					this.oldest = _.maxBy(creatures, creature => creature.age);
				}

				_.each(result.data, tile => {
					const x = tile.x * tileSize;
					const y = tile.y * tileSize;
					if (tile.type == "water") ctx.fillStyle = "blue";
					else if (tile.type == "tree") ctx.fillStyle = "brown";
					else if (tile.type == "mountain") ctx.fillStyle = "black";
					else if (tile.type == "hive") ctx.fillStyle = "green";
					else if (tile.type == "creature") {
						if (tile.id == this.oldest.id) {
							ctx.beginPath();
							ctx.arc(x + 2, y + 2, 20, 0, 2 * Math.PI);
							ctx.strokeStyle = "red";
							ctx.stroke();

							ctx.fillStyle = "red";
						} else {
							ctx.fillStyle = "yellow";
						}
					}

					// draw tile
					ctx.fillRect(x, y, tileSize, tileSize);
					ctx.fillStyle = "black";

					ctx.beginPath();
					if (tile.type == "creature") {
						switch (tile.facing) {
							case "up":
								ctx.moveTo(x, y);
								ctx.lineTo(x + tileSize, y);
								ctx.stroke();
								break;
							case "right":
								ctx.moveTo(x + tileSize, y);
								ctx.lineTo(x + tileSize, y + tileSize);
								ctx.stroke();
								break;
							case "down":
								ctx.moveTo(x, y + tileSize);
								ctx.lineTo(x + tileSize, y + tileSize);
								ctx.stroke();
								break;
							case "left":
								ctx.moveTo(x, y);
								ctx.lineTo(x, y + tileSize);
								ctx.stroke();
								break;
						}
						ctx.closePath();
						const range = tile.visibleRange;
						ctx.strokeStyle = "rgba(0,0,0,1)";
						ctx.rect(
							range.minX * tileSize,
							range.minY * tileSize,
							(range.maxX - range.minX) * tileSize,
							(range.maxY - range.minY) * tileSize
						);
						ctx.stroke();
						ctx.strokeStyle = "rgba(0,0,0,1)";
					}
				});
			});
		}
	},
	computed: {},
	created() {},
	mounted() {
		this.loop();
	}
};
</script>

<style>
#world_container {
	padding: 10px;
}
#world {
	background: #ddd;
}
#tile_water {
	background: blue;
	border: 1px solid white;
	width: 20px;
	height: 20px;
}
#tile_tree {
	background: brown;
	border: 1px solid white;
	width: 20px;
	height: 20px;
}
#tile_hive {
	background: green;
	border: 1px solid white;
	width: 20px;
	height: 20px;
}
#tile_mountain {
	background: black;
	border: 1px solid white;
	width: 20px;
	height: 20px;
}
#tile_remove {
	background: white;
	border: 1px solid white;
	width: 20px;
	height: 20px;
}

.oldest {
	max-width: 500px;
}
.energy {
	color: yellow;
}
.water {
	color: blue;
}
.food {
	color: brown;
}
</style>