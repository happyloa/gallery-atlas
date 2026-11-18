/** Clicking or tapping a painting in the canvas, and the pointer cursor over one. */
import { Raycaster, Vector2 } from "three";
import type { Mesh, PerspectiveCamera } from "three";

export interface PickingOptions {
  canvas: HTMLCanvasElement;
  camera: PerspectiveCamera;
  /** Invisible hit targets; each carries its work index in `userData.index`. */
  targets: Mesh[];
  activeIndex(): number;
  isDisposed(): boolean;
  onPick(index: number): void;
}

/** Attaches the listeners. Returns a function that removes them. */
export function attachPicking({
  canvas,
  camera,
  targets,
  activeIndex,
  isDisposed,
  onPick,
}: PickingOptions): () => void {
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  let downX = 0;
  let downY = 0;
  let hoverPending: PointerEvent | null = null;

  const pick = (clientX: number, clientY: number): number => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return -1;
    ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1),
    );
    raycaster.setFromCamera(ndc, camera);
    const [first] = raycaster.intersectObjects(targets, false);
    return first ? (first.object.userData.index as number) : -1;
  };

  const onPointerDown = (event: PointerEvent) => {
    downX = event.clientX;
    downY = event.clientY;
  };
  // A drag that ends on a painting is not a click on it.
  const onClick = (event: MouseEvent) => {
    if (Math.hypot(event.clientX - downX, event.clientY - downY) > 8) return;
    const index = pick(event.clientX, event.clientY);
    if (index >= 0 && index !== activeIndex()) onPick(index);
  };
  // Hover picking is throttled to one raycast per frame.
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    if (hoverPending) {
      hoverPending = event;
      return;
    }
    hoverPending = event;
    requestAnimationFrame(() => {
      const latest = hoverPending;
      hoverPending = null;
      if (isDisposed() || !latest) return;
      const index = pick(latest.clientX, latest.clientY);
      canvas.style.cursor =
        index >= 0 && index !== activeIndex() ? "pointer" : "";
    });
  };
  const onPointerLeave = () => {
    canvas.style.cursor = "";
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("click", onClick);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);

  return () => {
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("click", onClick);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    canvas.style.cursor = "";
  };
}
