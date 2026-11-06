// @vitest-environment jsdom
import {expect,test,vi} from "vitest";
import {render,cleanup} from "@testing-library/react";
import {ClearCompletedCart} from "./ClearCompletedCart";
const state=vi.hoisted(()=>({isLoaded:false,clearCart:vi.fn()}));
vi.mock("@/lib/health-plans",()=>({useCart:()=>state}));
test("waits for local storage hydration before clearing a verified completed order",()=>{const view=render(<ClearCompletedCart/>);expect(state.clearCart).not.toHaveBeenCalled();state.isLoaded=true;view.rerender(<ClearCompletedCart/>);expect(state.clearCart).toHaveBeenCalledOnce();cleanup();});
