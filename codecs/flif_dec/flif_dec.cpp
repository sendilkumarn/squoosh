#include <emscripten/bind.h>
#include <stdlib.h>

using namespace emscripten;

int version()
{
  return 10;
}

uint8_t* create_buffer(size_t size)
{
  return malloc(size);
}

void destroy_buffer(uint8_t* p)
{
  free(p);
}

void decode(uint8_t* img_in, int size)
{

}

EMSCRIPTEN_BINDINGS(my_module)
{
  function("version", &version);
  function("create_buffer", &create_buffer, allow_raw_pointers());
  function("destroy_buffer", &destroy_buffer, allow_raw_pointers());
  function("decode", &decode, allow_raw_pointers());
}
