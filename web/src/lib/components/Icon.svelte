<script lang="ts">

  let {
  data = "",
  viewBox = extractViewBox(data),
  size = "12px",
  width = size,
  height = size,
  color = "currentColor",
  stroke = color,
  fill = color,
  title = "",
  ...props
  } = $props()

  let elements = $derived(data.replace(/<svg[ \n]([^>]*)>/, "").replace("</svg>", ""));

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
  {...props}
>

  {#if title} <title>{title}</title> {/if}
  {@html elements}
</svg>
