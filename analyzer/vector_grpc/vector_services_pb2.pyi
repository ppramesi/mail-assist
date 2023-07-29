from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Iterable as _Iterable, Mapping as _Mapping, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class FitRequest(_message.Message):
    __slots__ = ["vectors"]
    VECTORS_FIELD_NUMBER: _ClassVar[int]
    vectors: _containers.RepeatedCompositeFieldContainer[FloatArray]
    def __init__(self, vectors: _Optional[_Iterable[_Union[FloatArray, _Mapping]]] = ...) -> None: ...

class TransformRequest(_message.Message):
    __slots__ = ["model_name", "vectors"]
    MODEL_NAME_FIELD_NUMBER: _ClassVar[int]
    VECTORS_FIELD_NUMBER: _ClassVar[int]
    model_name: str
    vectors: _containers.RepeatedCompositeFieldContainer[FloatArray]
    def __init__(self, model_name: _Optional[str] = ..., vectors: _Optional[_Iterable[_Union[FloatArray, _Mapping]]] = ...) -> None: ...

class VectorResponse(_message.Message):
    __slots__ = ["vectors"]
    VECTORS_FIELD_NUMBER: _ClassVar[int]
    vectors: _containers.RepeatedCompositeFieldContainer[FloatArray]
    def __init__(self, vectors: _Optional[_Iterable[_Union[FloatArray, _Mapping]]] = ...) -> None: ...

class Empty(_message.Message):
    __slots__ = []
    def __init__(self) -> None: ...

class FloatArray(_message.Message):
    __slots__ = ["values"]
    VALUES_FIELD_NUMBER: _ClassVar[int]
    values: _containers.RepeatedScalarFieldContainer[float]
    def __init__(self, values: _Optional[_Iterable[float]] = ...) -> None: ...
