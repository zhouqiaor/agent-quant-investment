import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { LucideTaroProvider } from 'lucide-react-taro';
import '@/app.css';
import { Toaster } from '@/components/ui/toast';
import { Preset } from './presets';
const App = ({ children }) => {
    return (_jsxs(LucideTaroProvider, { defaultColor: "#000", defaultSize: 24, children: [_jsx(Preset, { children: children }), _jsx(Toaster, {})] }));
};
export default App;
//# sourceMappingURL=app.js.map