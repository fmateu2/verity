/* VERITY — App entry. Mounts cockpit. */

const mount = document.getElementById("cockpit-mount");
if (mount) {
  const root = ReactDOM.createRoot(mount);
  root.render(<Cockpit />);
}
