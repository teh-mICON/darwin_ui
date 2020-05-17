<template>
	<div class="trend_container">
		<TrendChart
			class="trend"
			v-if="dataset.data"
			:datasets="[dataset]"
			:grid="grid"
			:min="0"
			:labels="labels"
			:interactive="true"
			@mouse-move="pointUpdate"
		></TrendChart>
		<div class="pointData" v-if="pointData">			
      <div>
        Age: {{pointData.age}}
			</div>
      <div>
        Generation: {{pointData.generation}}
			</div>
      <div>
        Elapsed Time: {{getElapsedPointTime()}}
			</div>
		</div>
	</div>
</template>

<script>
import Vue from "vue";
import _ from "lodash";
import utils from "../utils";
import prettyms from "pretty-ms";

export default Vue.extend({
	name: "scores",

	props: ["scores"],
	data() {
		return {
			grid: {
				verticalLines: true,
				horizontalLines: true
			},
			// chart: this.chart,
			uberSteps: [],
			dataset: {
				data: null,
				fill: true,
				className: "score_chart",
				showPoints: true
			},
			labels: {
				yLabels: 5,
				yLabelsTextFormatter: val => val,
				xLabels: []
			},
			pointData: null
		};
	},
	methods: {
		pointUpdate(point) {
      if(point === null) return this.pointData = null;
			this.pointData = point.data[0].step;
		},
    getElapsedPointTime() {
      return prettyms(this.pointData.elapsedTime)
    },

    translateScores(history) {
      this.dataset.data = _.map(history, step => {
				return { value: step.score, step };
			});
			this.labels.xLabels = _.map(history, (step) => step.generation)//prettyms(step.elapsedTime));
    }
	},
  computed: {},
  created() {
    this.translateScores(this.scores);
  },
	mounted() {
		Vue.set(this, "dataset");
	},
	watch: {
		scores(history) {
      this.translateScores(history);
		}
	},
	mounted() {}
});
</script>

<style>
.trend_container {
  margin: 10px;
}
.trend {
	height: 300px;
}

.trend .label text {
	fill: white;
	font-size: 10px;
}

.trend .stroke {
	stroke: #46828d;
	stroke-width: 2;
}
.trend .fill {
	fill: #46828d;
	fill-opacity: 0.1;
}

.point {
	display: none;
}

.point.is-active {
	display: block;
	stroke: white;
}
.active-line {
	stroke: rgba(255, 255, 255, 0.2);
}

.point.is-active {
	display: block;
}

.pointData {
  padding: 15px;
  border: 1px solid #46828d;
  border-radius: 3px;
  margin: 10px;
}
</style>