import BaseDomain from './domain';
import Overlay from './overlay';

export default class Page extends BaseDomain {
  namespace = 'Emulation';

  setTouchEmulationEnabled() {
    Overlay.unhighlight();
  }
}
