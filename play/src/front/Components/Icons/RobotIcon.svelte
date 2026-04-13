<script lang="ts">
    export let height = "h-6";
    export let width = "w-6";
    export let strokeColor = "stroke-white";
    export let fillColor = "fill-transparent";
    export let hover = "group-hover/btn-agents:fill-white";
    export let strokeWidth = "1.5";
    export let classList = "aspect-ratio transition-all";
</script>

<svg
    xmlns="http://www.w3.org/2000/svg"
    class="icon {height} {width} {strokeColor} {fillColor} {classList} {hover}"
    stroke-width={strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    viewBox="0 0 24 24"
>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M7 7h10a2 2 0 0 1 2 2v1H5V9a2 2 0 0 1 2 -2z" />
    <path d="M5 10h14v6a2 2 0 0 1 -2 2H7a2 2 0 0 1 -2 -2v-6z" />
    <path d="M12 4m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    <path d="M12 4v3" />
    <path d="M9 13.5v1" />
    <path d="M15 13.5v1" />
    <path d="M10 18h4" />
</svg>
