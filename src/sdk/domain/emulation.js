import BaseDomain from './domain';
import Overlay from './overlay';

export default class Emulation extends BaseDomain {
  namespace = 'Emulation';

  setTouchEmulationEnabled() {
    Overlay.unhighlight();
  }
}
