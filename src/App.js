import React, { useRef, useEffect, useState } from 'react';

function App() {
  const facialRecognitionModel = process.env.REACT_APP_FACE_RECOGNITION_MODEL || "Facenet";
  const faceDetector = process.env.REACT_APP_DETECTOR_BACKEND || "opencv";
  const distanceMetric = process.env.REACT_APP_DISTANCE_METRIC || "cosine";

  const serviceEndpoint = "http://localhost:5000";
  const antiSpoofing = process.env.REACT_APP_ANTI_SPOOFING === "1";
  const [userImagePath,setuser] = useState([]);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [isVerified, setIsVerified] = useState(null);
  const [identity, setIdentity] = useState(null);
  const [isAnalyzed, setIsAnalyzed] = useState(null);
  const [analysis, setAnalysis] = useState([]);
  const [targetEmbedding, setTargetEmbedding] = useState('');

  useEffect(() => {
    const loadFacialDb = async () => {
      const envVarsWithPrefix = {};
      for (const key in process.env) {
        if (key.startsWith("REACT_APP_USER_")) {
          envVarsWithPrefix[key.replace("REACT_APP_USER_", "")] = process.env[key];
        }
      }
      setuser(envVarsWithPrefix);
    };
    const video = videoRef.current;
    if (video) {
      const getVideo = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          video.srcObject = stream;
          await video.play();
        } catch (err) {
          console.error("Error accessing webcam: ", err);
        }
      };
      getVideo();
      loadFacialDb();
    }
  }, []);

  const captureImage = (task) => {
    setIsVerified(null);
    setIdentity(null);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const base64Img = canvas.toDataURL('image/jpg');

    if (!base64Img) return;

    if (task === "verify") {
      verify(base64Img);
    } else if (task === "analyze") {
      analyze(base64Img);
    }
  };

  const verify = async (base64Image) => {
    try {
      if (!targetEmbedding) {
        console.error("Target embedding not set");
        setIsVerified(false);
        return;
      }

      const requestBody = JSON.stringify({
        model_name: facialRecognitionModel,
        detector_backend: faceDetector,
        distance_metric: distanceMetric,
        align: true,
        img1_path: base64Image,
        img2_path: targetEmbedding,
        enforce_detection: false,
        anti_spoofing: antiSpoofing,
      });

      console.log("Request Body:", requestBody);  // Log the request body for debugging

      const response = await fetch(`${serviceEndpoint}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody,
      });

      const data = await response.json();
      console.log("Response Data:", data);  // Log the response data for debugging

      if (response.status !== 200) {
        console.log(data.error);
        setIsVerified(false);
        return;
      }

      if (data.verified) {
        setIsVerified(true);
        setIsAnalyzed(false);
        setIdentity("User");  // You can set it to a specific identity if needed
        return;
      }

      setIsVerified(false);
    } catch (error) {
      console.error('Exception while verifying image:', error);
    }
  };

  const analyze = async (base64Image) => {
    setIsAnalyzed(false);
    try {
      const requestBody = JSON.stringify({
        detector_backend: faceDetector,
        align: true,
        img_path: base64Image,
        enforce_detection: false,
        anti_spoofing: antiSpoofing,
      });

      const response = await fetch(`${serviceEndpoint}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody,
      });

      const data = await response.json();

      if (response.status !== 200) {
        console.log(data.error);
        return;
      }

      const result = data.results.map(instance =>
        `${instance.age} years old ${instance.dominant_race} ${instance.dominant_gender} with ${instance.dominant_emotion} moode.`
      );

      if (result.length > 0) {
        setIsAnalyzed(true);
        setIsVerified(null);
        setAnalysis(result);
      }
    } catch (error) {
      console.error('Exception while analyzing image:', error);
    }
  };

  const loadTargetEmbedding = () => {
    if (!userImagePath) {
      console.error("User image path not provided in environment variables.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setTargetEmbedding(reader.result);
    };
    reader.onerror = (error) => {
      console.error('Error reading image file:', error);
    };

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        reader.readAsDataURL(file);
      }
    };
    fileInput.click();
  };

  return (
    <div
      className="App"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        textAlign: 'center',
        backgroundColor: '#282c34',
        color: 'white'
      }}
    >
      <header className="App-header">
        <h1>DeepFace React App</h1>
        {isVerified === true && <p style={{ color: 'green' }}>Verified. Welcome {identity}</p>}
        {isVerified === false && <p style={{ color: 'red' }}>Not Verified</p>}
        {isAnalyzed === true && <p style={{ color: 'green' }}>{analysis.join(", ")}</p>}
        <video ref={videoRef} style={{ width: '100%', maxWidth: '500px' }} />
        <br/><br/>
        <button onClick={() => captureImage('verify')}>Verify</button>
        <button onClick={() => captureImage('analyze')}>Analyze</button>
        <br/><br/>
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <br/>
        <button onClick={loadTargetEmbedding}>Upload Image</button>
      </header>
    </div>
  );
}
export default App;
