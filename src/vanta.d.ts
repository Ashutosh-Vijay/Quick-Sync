// Replace the entire file content with this:
declare module 'vanta/dist/vanta.clouds.min.js' {
  const CLOUDS: (options: {
    el: HTMLElement | null;
    THREE: any;
    [key: string]: any;
  }) => {
    destroy: () => void;
    [key: string]: any;
  };
  export default CLOUDS;
}