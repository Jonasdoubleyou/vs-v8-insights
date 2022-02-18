var b = false;

function change_o() {
  // as long as b is false, this won't be reassigned ...
  if (b) o = { y : 1, x : 0};
}

var o = { x : 1 };

function f() {
  change_o();
  // ... and thus o.x can be compiled down
  return o.x;
}

// f and change_o are compiled somewhen 
%OptimizeFunctionOnNextCall(f);
f()

// a precondition changes
b = true;

// during execution of change_o o is reassigned and changes its shape, accessing o.x will now need a different offset and thus f (which is currently on the stack) becomes invalid
f();