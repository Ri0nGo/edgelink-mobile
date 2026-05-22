import * as echarts from 'echarts/core'
import { DataZoomComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { LineChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([GridComponent, LegendComponent, TooltipComponent, DataZoomComponent, LineChart, CanvasRenderer])

export { echarts }
