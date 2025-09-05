function get_hash_color(str: string, format: 'hsl' | 'hex'): string {
    let hash = 0;
    for (var i = 0; i < str.length; i++) {
       hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const positive_hash = hash & 0x00FFFFFF
    if (format === 'hsl') {
      const hue = positive_hash % 361
      return `hsl(${hue}, 70%, 55%)`
    } else if (format === 'hex'){
      const color = positive_hash.toString(16).toUpperCase();
      const padded_color = "#" + "00000".substring(0, 6 - color.length) + color;
      return padded_color
    } else {
      throw new Error(`unknown color format ${format}`)
    }
}


export { get_hash_color }

