import vector_grpc.vector_services_pb2_grpc
import vector_grpc.vector_services_pb2
import grpc
import os
import numpy as np
import pickle
from sklearn.decomposition import PCA, KernelPCA
from sklearn.manifold import TSNE
import umap
from concurrent import futures
from dotenv import load_dotenv
from vector_grpc.vector_services_pb2 import FloatArray, TransformRequest, Empty

def convert_to_proto(numpy_array):
    return [FloatArray(values=row.tolist()) for row in numpy_array]

def convert_from_proto(proto_array):
    return np.array([np.array(float_array.values) for float_array in proto_array])

dotenv_path = os.path.join(os.path.dirname(__file__), '..')
final_path = os.path.join(dotenv_path, '.env')

# Load the .env file
load_dotenv(dotenv_path=final_path)

class VectorService(vector_grpc.vector_services_pb2_grpc.VectorServiceServicer):
    def __init__(self):
        self.pipelines = {}

    def Fit(self, request, context):
        # Get the vector from the request
        vectors = convert_from_proto(request.vectors) # np.array([np.array(v.values) for v in request.vectors])

        # Define the pipelines
        self.pipelines = {
            "umap": umap.UMAP(n_components=3, n_neighbors=20, min_dist=0.25),
        }

        # Fit the models
        for name, pipeline in self.pipelines.items():
            if isinstance(pipeline, tuple):  # for PCA + TSNE/UMAP cases
                transformed_vector = vectors
                for step in pipeline:
                    step.fit(transformed_vector)
                    transformed_vector = step.transform(transformed_vector)
            else:
                pipeline.fit(vectors)
        pickle_path = os.path.join(os.path.dirname(__file__), 'models', "pipelines.pickle")
        with open(pickle_path, "wb") as f:
            pickle.dump(self.pipelines, f)
        
        return Empty()

    def Transform(self, request, context):
        # Load the model (assuming model name is passed as metadata in the request)
        model_name = request.model_name

        # Get the vector from the request
        vectors = np.array([np.array(v.values) for v in request.vectors])

        # Transform the vector
        pipeline = self.pipelines[model_name]
        if isinstance(pipeline, tuple):
            transformed_vector = vectors
            for step in pipeline:
                step.fit(transformed_vector)
                transformed_vector = step.transform(transformed_vector)
        else:
            transformed_vector = pipeline.transform(vectors)

        return vector_grpc.vector_services_pb2.VectorResponse(vectors=convert_to_proto(transformed_vector))

    def Load(self, request, context):
        pickle_path = os.path.join(os.path.dirname(__file__), 'models', "pipelines.pickle")
        with open(pickle_path, "rb") as f:
            self.pipelines = pickle.load(f)

        return Empty()


def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=5))
    vector_grpc.vector_services_pb2_grpc.add_VectorServiceServicer_to_server(
        VectorService(), server
    )
    address = '[::]:{}'.format(os.getenv('VECTOR_SERVICE_PORT'))
    print('trying to listen to {}'.format(address))
    server.add_insecure_port(address)
    server.start()
    server.wait_for_termination()

def test():
    vs = VectorService()
    vs.Load(request=None, context=None)
    transformed = vs.Transform(request=TransformRequest(
        model_name="pca",
        vectors=[FloatArray(
            values=np.random.uniform(low=0, high=1, size=(200,)).tolist()
        )]
    ), context=None)
    print(transformed)

if __name__ == '__main__':
    serve()
