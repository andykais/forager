<script lang="ts">
export let data = "";
export let viewBox = extractViewBox(data);
export let size = "12px";
export let width = size;
export let height = size;
export let color = "currentColor";
export let stroke = color;
export let fill = color;
export let title = "";
$: elements = data.replace(/<svg[ \n]([^>]*)>/, "").replace("</svg>", "");

function extractViewBox(svg: string) {
  const regex = /viewBox="([\d\- \.]+)"/;
  const res = regex.exec(svg);
  if (!res)
    return "0 0 20 20";
  return res[1];
}

</script>


<svg
  xmlns="http://www.w3.org/2000/svg"
  {width}
  {height}
  {viewBox}
  {stroke}
  {fill}
  {...$$restProps}
>

  {#if title} <title>{title}</title> {/if}
  {@html elements}
</svg>
