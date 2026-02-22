export function SketchfabEmbed() {
  return (
    <div className="relative w-full overflow-hidden rounded-xl h-[420px] md:h-[560px]">
      <iframe
        title="Detective Pinboard"
        src="https://sketchfab.com/models/f5b654327bf94c00affba06eb1f85e83/embed?autostart=1&ui_infos=0&ui_controls=0&ui_stop=0&ui_watermark=0&ui_help=0&ui_settings=0&ui_inspector=0&ui_annotations=0&transparent=1&ui_theme=dark"
        className="absolute inset-0 h-full w-full"
        frameBorder={0}
        allow="autoplay; fullscreen; xr-spatial-tracking"
        allowFullScreen
      />
    </div>
  );
}