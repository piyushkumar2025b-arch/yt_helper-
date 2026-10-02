import { TechWordEntry, ParsedSegment } from '../types';
import { extractCrucialKnowledge } from './knowledgeExtractionService';

/**
 * Comprehensive Technical & Academic Ontology for Computer Science,
 * AI, Networking, System Design, Operating Systems, DBMS, Compilers,
 * Computer Architecture, Data Structures, Algorithms, Cybersecurity & Engineering.
 */
export const TECH_WORDS_ENCYCLOPEDIA: TechWordEntry[] = [
  // ================= AI, MACHINE LEARNING & DEEP LEARNING =================
  {
    id: 'ai-neural-network',
    term: 'Neural Network',
    fullForm: 'Artificial Neural Network (ANN)',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'A computational system inspired by biological brains, organized into interconnected layers of artificial neurons that transform inputs through mathematical weights and activation functions to recognize complex patterns.',
    techArchitecture:
      'Composed of an Input Layer, multiple Hidden Layers (linear combinations z = W · x + b), and an Output Layer, trained by computing prediction loss L(ŷ, y) and adjusting parameters via backpropagation and gradient descent.',
    realWorldExample:
      'Image classifiers processing a 28x28 grayscale image of a handwritten digit into a probability distribution across digits 0 through 9.',
    complexityOrMetric: 'Parameter count: millions to trillions · Forward pass O(FLOPs)',
    relatedWords: ['Neuron', 'Weights & Biases', 'Activation Function', 'Gradient Descent', 'Backpropagation'],
  },
  {
    id: 'ai-neuron',
    term: 'Neuron',
    fullForm: 'Artificial Neuron (Perceptron / Node)',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'The atomic mathematical unit in a neural network that receives one or more numerical inputs, multiplies each by a weight, adds a bias, and passes the sum through an activation function.',
    techArchitecture:
      'Computes a = σ(∑ w_i x_i + b), where w represents incoming connection strengths, b represents the threshold or bias, and σ is a non-linear activation function.',
    realWorldExample:
      'A single neuron firing a high activation when detecting a horizontal line segment in the upper-left quadrant of an image.',
    complexityOrMetric: 'Activation value a ∈ [0, 1] or ℝ',
    relatedWords: ['Neural Network', 'Weights & Biases', 'Activation Function'],
  },
  {
    id: 'ai-weights-biases',
    term: 'Weights & Biases',
    fullForm: 'Learnable Model Parameters (W and b)',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'The adjustable numerical dials inside a neural network: weights scale the importance of incoming signals, while biases shift the activation threshold before non-linearity is applied.',
    techArchitecture:
      'Weights W ∈ ℝ^(d_out × d_in) determine linear transformation geometry; biases b ∈ ℝ^(d_out) shift the decision boundary away from the origin. Updated during training: θ ← θ - η ∇_θ L.',
    realWorldExample:
      'A weight of +4.2 strongly positive for detecting an edge, versus a weight of -3.1 that suppresses the neuron if the pixel is dark.',
    complexityOrMetric: 'Trainable parameters: θ = {W, b}',
    relatedWords: ['Gradient Descent', 'Backpropagation', 'Neuron'],
  },
  {
    id: 'ai-loss-function',
    term: 'Loss Function',
    fullForm: 'Cost Function / Objective Function',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'A mathematical score measuring how wrong the neural network’s predictions are compared to the true target values—the objective of training is to drive this number as close to zero as possible.',
    techArchitecture:
      'Common formulations include Mean Squared Error (MSE) for regression, and Cross-Entropy Loss L = -∑ y_i log(ŷ_i) for classification, providing smooth differentiability for gradient computation.',
    realWorldExample:
      'If the network guesses "digit 8" with only 12% confidence when the label is 8, the cross-entropy loss produces a steep error signal to penalize the prediction.',
    complexityOrMetric: 'Scalar loss L ∈ [0, ∞)',
    relatedWords: ['Gradient Descent', 'Backpropagation', 'Cross-Entropy'],
  },
  {
    id: 'ai-cost-function',
    term: 'Cost Function',
    fullForm: 'Aggregate Empirical Risk Function J(θ)',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'The average loss calculated across an entire training dataset or mini-batch, representing the overall model performance to be minimized.',
    techArchitecture:
      'J(θ) = (1/m) ∑ L(f(x^(i); θ), y^(i)) + λ R(θ), where R(θ) is optional regularization penalty.',
    realWorldExample:
      'Calculating the average error over 60,000 MNIST training images to guide parameter updates.',
    complexityOrMetric: 'Batch Loss J(θ)',
    relatedWords: ['Loss Function', 'Gradient Descent', 'Regularization'],
  },
  {
    id: 'ai-gradient-descent',
    term: 'Gradient Descent',
    fullForm: 'Stochastic Gradient Descent (SGD / AdamW Optimizer)',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'The foundational optimization algorithm that iteratively nudges every weight and bias in the network in the direction that decreases the loss function most rapidly.',
    techArchitecture:
      'Calculates the negative gradient vector -∇_θ L of the loss with respect to all parameters and updates weights via θ_(t+1) = θ_t - η · ∇_θ L, often augmented with momentum and adaptive learning rates (Adam / AdamW).',
    realWorldExample:
      'Navigating a blind hiker down a foggy mountain by feeling which direction slopes downward most steeply at each step.',
    complexityOrMetric: 'Learning rate η (typically 1e-4 to 1e-3)',
    relatedWords: ['Backpropagation', 'Loss Function', 'Learning Rate'],
  },
  {
    id: 'ai-backpropagation',
    term: 'Backpropagation',
    fullForm: 'Backward Propagation of Errors (Chain Rule Optimization)',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'The mathematical algorithm that efficiently computes how much each individual weight and bias in every layer contributed to the overall prediction error, enabling gradient descent.',
    techArchitecture:
      'Applies the multivariable calculus Chain Rule ∂L/∂w = (∂L/∂a) · (∂a/∂z) · (∂z/∂w) backward from the final output layer through intermediate hidden layers, storing intermediate gradients to prevent redundant computation.',
    realWorldExample:
      'Adjusting 100,000 parameters in a 4-layer network in a fraction of a millisecond using automatic differentiation.',
    complexityOrMetric: 'O(W) time per training iteration equal to 2x forward pass FLOPs',
    relatedWords: ['Gradient Descent', 'Chain Rule', 'Loss Function'],
  },
  {
    id: 'ai-activation-function',
    term: 'Activation Function',
    fullForm: 'Non-Linear Activation Function (ReLU, Sigmoid, GELU, Softmax)',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'The mathematical curve applied to each neuron’s output that introduces non-linearity, allowing neural networks to learn complex curves and boundaries instead of simple straight lines.',
    techArchitecture:
      'Without non-linear activations, stacking multiple layers collapses mathematically into a single linear matrix multiplication W_2(W_1 x) = W_comb x. Popular functions include ReLU(z) = max(0, z), GELU(z) = z · Φ(z), and Sigmoid(z) = 1 / (1 + e^(-z)).',
    realWorldExample:
      'ReLU turning off negative values to simulate biological neural spiking thresholds, speeding up gradient propagation.',
    complexityOrMetric: 'Pointwise element evaluation O(N)',
    relatedWords: ['Neuron', 'Neural Network', 'Sigmoid', 'ReLU'],
  },
  {
    id: 'ai-relu',
    term: 'ReLU',
    fullForm: 'Rectified Linear Unit Activation Function',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'The most widely used activation function in modern deep learning: it outputs the input directly if positive, otherwise zero.',
    techArchitecture:
      'f(x) = max(0, x). Solves vanishing gradient problem for positive inputs; derivative is 1 for x > 0 and 0 for x < 0.',
    realWorldExample:
      'Enabling deep networks with hundreds of layers to train without gradients evaporating to zero.',
    complexityOrMetric: 'Derivative: f’(x) ∈ {0, 1}',
    relatedWords: ['Activation Function', 'GELU', 'Sigmoid'],
  },
  {
    id: 'ai-sigmoid',
    term: 'Sigmoid',
    fullForm: 'Logistic Sigmoid Activation Function',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'An S-shaped mathematical curve that compresses any input value into a number between 0 and 1, ideal for outputting probabilities.',
    techArchitecture:
      'σ(z) = 1 / (1 + e^(-z)). Derivative σ’(z) = σ(z)(1 - σ(z)). Prone to vanishing gradients at extreme values.',
    realWorldExample:
      'Converting raw logit outputs into a calibrated probability that an email is spam (e.g. 0.94 probability).',
    complexityOrMetric: 'Range: (0, 1)',
    relatedWords: ['Activation Function', 'Softmax', 'Cross-Entropy'],
  },
  {
    id: 'ai-softmax',
    term: 'Softmax',
    fullForm: 'Normalized Exponential Function (Multiclass Probability)',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'A mathematical function that turns a list of arbitrary real numbers (logits) into a probability distribution where all values sum to 1.0 (100%).',
    techArchitecture:
      'Softmax(z_i) = e^(z_i) / ∑_(j) e^(z_j). Exponentiates logits and normalizes by their sum, accentuating the highest value.',
    realWorldExample:
      'Predicting which of 10 digits an image represents: digit 7 receives 0.91, digit 1 receives 0.05, etc.',
    complexityOrMetric: '∑ p_i = 1.0',
    relatedWords: ['Logits', 'Cross-Entropy', 'Classification'],
  },
  {
    id: 'ai-transformer',
    term: 'Transformer',
    fullForm: 'Transformer Neural Network Architecture (Vaswani et al., 2017)',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'The foundational deep learning architecture behind modern Large Language Models that processes all words in a sequence simultaneously and learns direct relationships between any two tokens regardless of distance.',
    techArchitecture:
      'Replaces sequential recurrent processing (RNN/LSTM) with stacked Multi-Head Self-Attention and Feed-Forward Network (FFN) layers, residual connections, and positional embeddings (such as RoPE).',
    realWorldExample:
      'Modern foundation models (Gemini, Claude, GPT-4, Llama 3) generating coherent multi-page analyses and understanding cross-document references.',
    complexityOrMetric: 'O(N²) attention complexity across sequence length N',
    relatedWords: ['Self-Attention', 'LLM', 'KV Cache', 'Tokenization'],
  },
  {
    id: 'ai-self-attention',
    term: 'Self-Attention',
    fullForm: 'Scaled Dot-Product Self-Attention Mechanism',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'A mechanism allowing a model to dynamically score how much every word in a sentence relates to every other word when computing representations.',
    techArchitecture:
      'Projects input vectors into Query (Q), Key (K), and Value (V) matrices. Computes attention weights via Attention(Q,K,V) = Softmax((Q · Kᵀ) / √d_k) · V across multiple parallel heads.',
    realWorldExample:
      'In "The server failed because it ran out of memory," self-attention links "it" strongly to "server" rather than "memory."',
    complexityOrMetric: 'Softmax(QKᵀ / √d_k) V',
    relatedWords: ['Transformer', 'KV Cache', 'Embeddings'],
  },
  {
    id: 'ai-llm',
    term: 'LLM',
    fullForm: 'Large Language Model (Foundation Generative Model)',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'A massive deep neural network trained on hundreds of billions or trillions of text tokens to predict subsequent tokens, developing general reasoning, coding, and synthesis capabilities.',
    techArchitecture:
      'Autoregressive decoder-only Transformer trained on next-token prediction loss L = -∑ log P(x_t | x_(<t)), typically aligned via RLHF, DPO, or constitutional AI.',
    realWorldExample:
      'An engineer prompting an LLM to debug a memory leak or transcribe and summarize technical conference talks.',
    complexityOrMetric: 'Parameter scales: 7B to 1T+ parameters',
    relatedWords: ['Transformer', 'Tokenization', 'Fine-Tuning', 'RLHF'],
  },
  {
    id: 'ai-rag',
    term: 'RAG',
    fullForm: 'Retrieval-Augmented Generation',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'An AI architecture that searches an external database or document collection for relevant factual snippets and inserts them into the prompt so the language model answers with grounded accuracy.',
    techArchitecture:
      'Workflow: Query → Dense Vector / Sparse BM25 Search → Top-K Context Window Assembly → Generative LLM Synthesis with explicit citations.',
    realWorldExample:
      'Searching an enterprise technical manual to answer customer queries with exact page references rather than hallucinated answers.',
    complexityOrMetric: 'Hybrid dense-sparse retrieval + Re-ranking pass',
    relatedWords: ['Vector Database', 'Embeddings', 'BM25', 'Grounding'],
  },
  {
    id: 'ai-vector-database',
    term: 'Vector Database',
    fullForm: 'High-Dimensional Approximate Nearest Neighbor (ANN) Index',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'A database specialized in storing mathematical vector embeddings (lists of numbers) and finding items with the closest meaning at sub-second speeds.',
    techArchitecture:
      'Uses indexing algorithms like HNSW (Hierarchical Navigable Small World) or IVF-PQ to calculate Cosine Similarity or Euclidean Distance across millions of 1536-dimensional vectors.',
    realWorldExample:
      'Finding the 3 most relevant segments of a video transcript when a user asks a technical question.',
    complexityOrMetric: 'O(log N) search latency via HNSW graphs',
    relatedWords: ['Embeddings', 'Cosine Similarity', 'RAG'],
  },
  {
    id: 'ai-embeddings',
    term: 'Embeddings',
    fullForm: 'Dense High-Dimensional Semantic Vector Representations',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'Translating words, sentences, or code into coordinates in mathematical space where concepts with similar meanings are located close to each other.',
    techArchitecture:
      'A neural network maps text to a fixed-length vector v ∈ ℝ^d (e.g. d = 768 or 1536). Closeness is measured using cosine similarity cos(θ) = (u · v) / (‖u‖ ‖v‖).',
    realWorldExample:
      'The embedding for "PostgreSQL" sits close to "relational database" and far from "banana" in vector space.',
    complexityOrMetric: 'Dimension d: 384 to 3072 floating-point values',
    relatedWords: ['Vector Database', 'Cosine Similarity', 'Tokenization'],
  },
  {
    id: 'ai-tokenization',
    term: 'Tokenization',
    fullForm: 'Subword Segmentation (BPE / WordPiece / SentencePiece)',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'The process of chopping human text into smaller mathematical chunks called tokens (words, parts of words, or punctuation) that neural networks can process.',
    techArchitecture:
      'Algorithms like Byte-Pair Encoding (BPE) iteratively merge frequent character pairs into a fixed vocabulary (e.g., 32,000 to 256,000 tokens), handling unseen words gracefully.',
    realWorldExample:
      'The word "unbelievable" broken into three tokens: ["un", "believ", "able"].',
    complexityOrMetric: '~1 token ≈ 0.75 English words',
    relatedWords: ['LLM', 'Transformer', 'Vocabulary'],
  },
  {
    id: 'ai-quantization',
    term: 'Quantization',
    fullForm: 'Model Precision Reduction (FP32 → FP16 / INT8 / INT4)',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'Compressing an AI model by reducing the numerical precision of its weights (e.g., from 32-bit floating point down to 8-bit or 4-bit integers) to make it run faster and use far less RAM.',
    techArchitecture:
      'Maps continuous weights W to discrete integer grids: W_q = round(W / scale) + zero_point, cutting VRAM usage by 50%–75% with minimal accuracy degradation.',
    realWorldExample:
      'Running a 70-billion parameter LLM on a consumer workstation GPU with 24 GB VRAM instead of requiring an expensive multi-GPU server.',
    complexityOrMetric: 'Memory reduction: 4x (FP32 to INT8) or 8x (FP32 to INT4)',
    relatedWords: ['VRAM', 'Inference', 'Pruning'],
  },
  {
    id: 'ai-lora',
    term: 'LoRA',
    fullForm: 'Low-Rank Adaptation of Large Language Models',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'An efficient fine-tuning technique that freezes original model weights and trains two tiny low-rank adapter matrices alongside them, saving 99% of training memory.',
    techArchitecture:
      'Decomposes weight updates ΔW into low-rank matrices B · A where B ∈ ℝ^(d × r) and A ∈ ℝ^(r × k) with rank r ≪ min(d, k), dramatically reducing trainable parameters.',
    realWorldExample:
      'Adapting a generic base LLM into a specialized medical or legal assistant in hours on a single GPU.',
    complexityOrMetric: 'Rank r: typically 8, 16, or 64',
    relatedWords: ['Fine-Tuning', 'PEFT', 'Weights & Biases'],
  },
  {
    id: 'ai-fine-tuning',
    term: 'Fine-Tuning',
    fullForm: 'Transfer Learning & Supervised Fine-Tuning (SFT)',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'Taking a pre-trained foundation model and continuing its training on a curated, domain-specific dataset so it masters a specialized skill or tone of voice.',
    techArchitecture:
      'Applies gradient descent on domain-specific prompt-completion pairs {(x_i, y_i)}, updating weights or adapter layers with a lower learning rate than initial pre-training.',
    realWorldExample:
      'Teaching an AI to write idiomatic Rust code conforming strictly to a company’s internal coding style guide.',
    complexityOrMetric: 'Supervised loss minimization with low learning rate',
    relatedWords: ['LoRA', 'RLHF', 'Pre-training'],
  },
  {
    id: 'ai-rlhf',
    term: 'RLHF',
    fullForm: 'Reinforcement Learning from Human Feedback',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'A training technique that aligns AI models to human values by using human ratings of model answers to train a reward model, which then guides the AI via reinforcement learning.',
    techArchitecture:
      'PPO (Proximal Policy Optimization) or DPO (Direct Preference Optimization) optimizes the model’s policy to maximize human reward scores while penalizing divergence from the base model via KL-divergence.',
    realWorldExample:
      'Ensuring an AI assistant refuses to generate malware instructions and provides helpful, polite, and fact-checked responses.',
    complexityOrMetric: 'Reward Model + Policy Optimization via PPO/DPO',
    relatedWords: ['Reward Model', 'DPO', 'Alignment'],
  },
  {
    id: 'ai-overfitting',
    term: 'Overfitting',
    fullForm: 'High Variance Generalization Failure',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'When a machine learning model memorizes training samples too closely, achieving near-zero training error but failing to predict correctly on new, unseen data.',
    techArchitecture:
      'Model capacity exceeds data complexity. Mitigated using regularization (L2 weight decay, dropout), early stopping, and data augmentation.',
    realWorldExample:
      'A student memorizing exact practice exam questions word-for-word, but blanking out when numbers change on the real test.',
    complexityOrMetric: 'Low training loss + High validation loss',
    relatedWords: ['Regularization', 'Dropout', 'Underfitting'],
  },
  {
    id: 'ai-regularization',
    term: 'Regularization',
    fullForm: 'Complexity Penalty (L1 Lasso / L2 Ridge / Weight Decay)',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'Techniques added to the loss function during training to penalize overly large weights, forcing the model to learn simpler and more general patterns.',
    techArchitecture:
      'Modifies objective: L_reg = L_data + λ ∑ w_i² (L2 weight decay) or λ ∑ |w_i| (L1 sparsity).',
    realWorldExample:
      'Preventing a single input pixel from dominating a neural network’s digit recognition decision.',
    complexityOrMetric: 'Regularization parameter λ > 0',
    relatedWords: ['Overfitting', 'Dropout', 'Loss Function'],
  },
  {
    id: 'ai-dropout',
    term: 'Dropout',
    fullForm: 'Stochastic Neuronal Deactivation Regularization',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'A training technique where a random percentage of neurons are temporarily turned off on each training step, preventing neurons from relying co-dependently on each other.',
    techArchitecture:
      'Multiplies layer activations by a Bernoulli mask m ~ Bernoulli(1 - p), scaling remaining outputs by 1 / (1 - p) during training. Disabled during evaluation.',
    realWorldExample:
      'Forcing an image classifier to recognize dogs by ears, snout, and coat independently rather than depending on a single feature.',
    complexityOrMetric: 'Dropout probability p (typically 0.1 to 0.5)',
    relatedWords: ['Regularization', 'Overfitting', 'Neuron'],
  },
  {
    id: 'ai-cnn',
    term: 'CNN',
    fullForm: 'Convolutional Neural Network',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'A specialized neural network architecture for grid-like data (images and audio spectrograms) that slides small mathematical filters across inputs to detect local visual features.',
    techArchitecture:
      'Stacks Convolutional Layers (feature map C = X * K), Pooling Layers (MaxPooling / AveragePooling), and Fully Connected layers, leveraging translation invariance and parameter sharing.',
    realWorldExample:
      'Detecting edges in early layers, textures in middle layers, and complete objects like faces or cars in deeper layers.',
    complexityOrMetric: 'Convolution O(K² · C_in · C_out · H · W)',
    relatedWords: ['Kernel / Filter', 'Pooling Layer', 'Computer Vision'],
  },

  // ================= NETWORKING & PROTOCOLS =================
  {
    id: 'net-tcp',
    term: 'TCP',
    fullForm: 'Transmission Control Protocol (OSI Layer 4)',
    domain: 'Networking & Protocols',
    importance: 'essential',
    plainMeaning:
      'The foundational internet protocol that guarantees reliable, ordered, and error-checked delivery of a stream of data packets between two applications.',
    techArchitecture:
      'Establishes connection via Three-Way Handshake (SYN, SYN-ACK, ACK); tracks delivery with sequence and acknowledgment numbers; regulates traffic via Sliding Window flow control and congestion avoidance algorithms (Cubic, BBR).',
    realWorldExample:
      'Downloading a video file or loading a web page where every single byte must arrive intact without missing pieces.',
    complexityOrMetric: 'Reliable byte-stream · 3-way handshake · Flow & Congestion Control',
    relatedWords: ['UDP', 'Three-Way Handshake', 'Sliding Window', 'Congestion Control'],
  },
  {
    id: 'net-udp',
    term: 'UDP',
    fullForm: 'User Datagram Protocol (OSI Layer 4)',
    domain: 'Networking & Protocols',
    importance: 'essential',
    plainMeaning:
      'A lightweight, connectionless networking protocol that sends data packets without establishing a connection or guaranteeing delivery, prioritizing maximum speed and minimum latency.',
    techArchitecture:
      'Header consists of only 8 bytes (Source Port, Destination Port, Length, Checksum); does not track packet loss, retransmissions, or packet ordering.',
    realWorldExample:
      'Live multiplayer gaming, real-time voice calls (VoIP), and video conference streams where an occasional lost packet is better than stalling.',
    complexityOrMetric: 'Zero handshake · 8-byte minimal header · Fire-and-forget',
    relatedWords: ['TCP', 'DNS', 'QUIC', 'Socket'],
  },
  {
    id: 'net-ip',
    term: 'IP',
    fullForm: 'Internet Protocol (IPv4 / IPv6, OSI Layer 3)',
    domain: 'Networking & Protocols',
    importance: 'essential',
    plainMeaning:
      'The principal communications protocol responsible for addressing and routing individual data packets across computer networks from source host to destination host.',
    techArchitecture:
      'IPv4 uses 32-bit addresses (e.g. 192.168.1.1); IPv6 uses 128-bit hexadecimal addresses (e.g. 2001:db8::1). Packets encapsulate transport layer data with TTL (Time To Live) and routing headers.',
    realWorldExample:
      'Routers across five countries forwarding your video stream packets step-by-step to reach your home Wi-Fi network.',
    complexityOrMetric: 'IPv4: 2^32 addresses · IPv6: 2^128 addresses',
    relatedWords: ['Subnet', 'Router', 'BGP', 'DNS'],
  },
  {
    id: 'net-dns',
    term: 'DNS',
    fullForm: 'Domain Name System (Internet Phonebook)',
    domain: 'Networking & Protocols',
    importance: 'essential',
    plainMeaning:
      'The hierarchical decentralized naming system that translates human-friendly domain names (like youtube.com) into numerical machine IP addresses (like 142.250.190.46).',
    techArchitecture:
      'Operates recursively: Stub Resolver → Root Server (.) → TLD Server (.com) → Authoritative DNS Server. Uses UDP port 53 with caching governed by TTL (Time-To-Live).',
    realWorldExample:
      'Typing google.com in a browser and resolving it to a nearby data center IP in 15 milliseconds.',
    complexityOrMetric: 'Hierarchical query tree · UDP Port 53 · Cached via TTL',
    relatedWords: ['IP', 'TTL', 'Subnet', 'Reverse Proxy'],
  },
  {
    id: 'net-handshake',
    term: 'Three-Way Handshake',
    fullForm: 'TCP Connection Establishment (SYN, SYN-ACK, ACK)',
    domain: 'Networking & Protocols',
    importance: 'essential',
    plainMeaning:
      'The 3-step conversation two computers perform before exchanging TCP data to agree on sequence numbers and verify both sides can send and receive packets.',
    techArchitecture:
      '1. Client sends SYN (Synchronize sequence number x). 2. Server replies SYN-ACK (ack x+1, syn y). 3. Client replies ACK (ack y+1). Connection is now ESTABLISHED.',
    realWorldExample:
      'Your phone connecting to a media server before streaming starts, verifying two-way communication.',
    complexityOrMetric: '1 full RTT (Round Trip Time) before first data payload',
    relatedWords: ['TCP', 'RTT', 'TLS Handshake', 'SYN Flood'],
  },
  {
    id: 'net-tls',
    term: 'TLS / SSL',
    fullForm: 'Transport Layer Security (Cryptographic Protocol)',
    domain: 'Networking & Protocols',
    importance: 'essential',
    plainMeaning:
      'The cryptographic protocol that encrypts network traffic between client and server, turning insecure HTTP into secure HTTPS and protecting passwords and data from eavesdroppers.',
    techArchitecture:
      'TLS 1.3 performs handshake using Elliptic Curve Diffie-Hellman (ECDHE) for perfect forward secrecy, authenticates server via X.509 certificates, and encrypts payloads with AES-GCM or ChaCha20.',
    realWorldExample:
      'The padlock icon in your browser URL bar confirming your connection and logins cannot be intercepted by public Wi-Fi sniffers.',
    complexityOrMetric: '1-RTT handshake (TLS 1.3) · 256-bit symmetric encryption',
    relatedWords: ['HTTPS', 'Certificate Authority', 'AES', 'Public Key'],
  },
  {
    id: 'net-http2',
    term: 'HTTP/2 & HTTP/3',
    fullForm: 'Multiplexed Web Protocols (Binary Framing & QUIC)',
    domain: 'Networking & Protocols',
    importance: 'essential',
    plainMeaning:
      'Modern web protocols that allow hundreds of files, images, and API requests to stream concurrently over a single connection without waiting in line.',
    techArchitecture:
      'HTTP/2 introduces binary framing and multiplexed streams over TCP with HPACK header compression. HTTP/3 moves to UDP-based QUIC, eliminating TCP head-of-line blocking and speeding up mobile handoffs.',
    realWorldExample:
      'Loading a web page with 50 images and JavaScript files simultaneously over a single network pipe without delay.',
    complexityOrMetric: 'Multiplexed binary streams · Zero head-of-line blocking in HTTP/3',
    relatedWords: ['TCP', 'UDP', 'Latency', 'Bandwidth'],
  },
  {
    id: 'net-socket',
    term: 'Socket & WebSocket',
    fullForm: 'Bidirectional Network Endpoints (RFC 6455)',
    domain: 'Networking & Protocols',
    importance: 'essential',
    plainMeaning:
      'An open, continuous two-way communication channel between browser and server that allows data to flow back and forth instantly without repeatedly opening new HTTP connections.',
    techArchitecture:
      'Initiated via an HTTP 101 Switching Protocols upgrade handshake, then maintains a persistent TCP full-duplex framing protocol with minimal 2-10 byte framing overhead.',
    realWorldExample:
      'Live chat rooms, collaborative document editing, and real-time multiplayer games updating at 60 frames per second.',
    complexityOrMetric: 'Full-duplex persistent stream · Millisecond message delivery',
    relatedWords: ['TCP', 'HTTP', 'Long Polling', 'SSE'],
  },
  {
    id: 'net-routing',
    term: 'Router & BGP',
    fullForm: 'Border Gateway Protocol & Network Routing Tables',
    domain: 'Networking & Protocols',
    importance: 'essential',
    plainMeaning:
      'Routers are hardware devices that forward data packets between different networks; BGP is the global postal system protocol that determines the fastest route across the worldwide internet.',
    techArchitecture:
      'Operates at OSI Layer 3. Inspects destination IP headers, matches longest CIDR prefix against routing tables, and computes shortest path across Autonomous Systems (AS) via path-vector BGP.',
    realWorldExample:
      'Automatically steering your video data around an undersea fiber cable outage in the Atlantic Ocean without interrupting your playback.',
    complexityOrMetric: 'CIDR longest-prefix match · Autonomous System (AS) graph',
    relatedWords: ['IP', 'Packet Loss', 'Latency', 'Throughput'],
  },
  {
    id: 'net-load-balancer',
    term: 'Load Balancer',
    fullForm: 'Reverse Proxy Traffic Distributor (Layer 4 / Layer 7)',
    domain: 'Networking & Protocols',
    importance: 'essential',
    plainMeaning:
      'A traffic director sitting in front of backend servers that distributes incoming user requests across dozens of machines so no single server gets overwhelmed.',
    techArchitecture:
      'L4 load balancers route TCP/UDP packets by IP and port; L7 load balancers inspect HTTP headers, cookies, and URLs to route requests intelligently using Round-Robin, Least Connections, or Consistent Hashing.',
    realWorldExample:
      'Handling 100,000 simultaneous video viewers by distributing requests evenly across 50 backend streaming nodes.',
    complexityOrMetric: 'Round Robin · Least Connections · Consistent Hashing',
    relatedWords: ['Reverse Proxy', 'Horizontal Scaling', 'High Availability'],
  },
  {
    id: 'net-cdn',
    term: 'CDN',
    fullForm: 'Content Delivery Network (Edge Caching)',
    domain: 'Networking & Protocols',
    importance: 'essential',
    plainMeaning:
      'A global network of servers that caches copies of videos, web pages, and images close to where users physically live, drastically reducing loading times.',
    techArchitecture:
      'Uses Anycast DNS routing to direct user requests to the nearest Point of Presence (PoP) edge node; serves cached content with Cache-Control headers, forwarding misses to origin servers.',
    realWorldExample:
      'Streaming a video from an edge cache 5 miles from your home instead of waiting for packets to travel 6,000 miles to a primary data center.',
    complexityOrMetric: 'Latency cut from ~150ms to <15ms via geographic proximity',
    relatedWords: ['Caching', 'Latency', 'Bandwidth', 'Reverse Proxy'],
  },
  {
    id: 'net-latency',
    term: 'Latency & Bandwidth',
    fullForm: 'Network Propagation Delay vs Channel Capacity',
    domain: 'Networking & Protocols',
    importance: 'essential',
    plainMeaning:
      'Latency is the time it takes for a single data packet to travel from sender to receiver (delay); bandwidth is the maximum volume of data that can fit through the pipe per second (width).',
    techArchitecture:
      'Latency = Transmission Delay + Propagation Delay (governed by speed of light in fiber, ~5ms/1000km) + Queuing Delay + Processing Delay. Bandwidth-Delay Product (BDP) determines the required TCP window size.',
    realWorldExample:
      'A high-bandwidth connection (1 Gbps) can still feel sluggish if latency is high (300ms round-trip to an overseas server).',
    complexityOrMetric: 'RTT measured in milliseconds (ms) · Bandwidth in Mbps/Gbps',
    relatedWords: ['Throughput', 'Packet Loss', 'RTT', 'Sliding Window'],
  },

  // ================= SYSTEMS & CLOUD ARCHITECTURE =================
  {
    id: 'sys-scalability',
    term: 'Horizontal vs Vertical Scaling',
    fullForm: 'Scale-Out (Clustering) vs Scale-Up (Hardware Expansion)',
    domain: 'Systems & Cloud',
    importance: 'essential',
    plainMeaning:
      'Vertical scaling means buying a bigger, more powerful server; horizontal scaling means adding more standard servers to work together as a cluster.',
    techArchitecture:
      'Horizontal scaling requires stateless application tiers, load balancers, and distributed data stores (sharding/replication). Vertical scaling is constrained by physical motherboard and CPU socket limits.',
    realWorldExample:
      'Adding 10 cloud server instances dynamically when video traffic spikes during a live broadcast.',
    complexityOrMetric: 'Scale-out elasticity · N-node linear throughput',
    relatedWords: ['Load Balancer', 'Sharding', 'Microservices'],
  },
  {
    id: 'sys-cap-theorem',
    term: 'CAP Theorem',
    fullForm: 'Consistency, Availability, Partition Tolerance (Brewer’s Theorem)',
    domain: 'Systems & Cloud',
    importance: 'essential',
    plainMeaning:
      'A fundamental law of distributed computer systems stating that when network cables fail between servers (partitions), the system must choose between returning accurate data or remaining available, but cannot guarantee both.',
    techArchitecture:
      'Under a network partition (P): a CP system (like etcd, ZooKeeper, or Paxos/Raft) rejects requests to preserve Consistency; an AP system (like Cassandra, DynamoDB) accepts writes to preserve Availability, settling for eventual consistency.',
    realWorldExample:
      'An ATM refusing transactions when it loses connection to the central bank (CP) versus a social media app letting you like posts while offline (AP).',
    complexityOrMetric: 'Trade-off: CP (Strong Consistency) vs AP (High Availability)',
    relatedWords: ['Eventual Consistency', 'Raft Consensus', 'Partitioning'],
  },
  {
    id: 'sys-caching',
    term: 'Caching & Redis',
    fullForm: 'In-Memory Key-Value Caching & Eviction Policies',
    domain: 'Systems & Cloud',
    importance: 'essential',
    plainMeaning:
      'Storing frequently accessed data in ultra-fast RAM so future requests return in microseconds without querying a slow disk-based database repeatedly.',
    techArchitecture:
      'Patterns: Cache-Aside, Write-Through, Write-Back. Eviction algorithms: LRU (Least Recently Used), LFU (Least Frequently Used). Redis stores data structures in RAM with asynchronous disk persistence (RDB/AOF).',
    realWorldExample:
      'Caching video metadata and transcripts in Redis so 10,000 simultaneous users load the page instantly with 0% database strain.',
    complexityOrMetric: 'RAM read latency < 1ms vs Disk read 10-50ms',
    relatedWords: ['Redis', 'CDN', 'LRU Cache', 'Database Index'],
  },
  {
    id: 'sys-message-queue',
    term: 'Message Queue & Kafka',
    fullForm: 'Asynchronous Event Streaming (Kafka / RabbitMQ / SQS)',
    domain: 'Systems & Cloud',
    importance: 'essential',
    plainMeaning:
      'A temporary holding buffer that allows different software components to communicate by sending events asynchronously, so one busy service doesn’t freeze the entire system.',
    techArchitecture:
      'Decouples producers and consumers using distributed append-only commit logs. Partitioning enables horizontal consumption; consumer groups track offsets independently.',
    realWorldExample:
      'When a user uploads a video, the web server places a "transcode-video" event into Kafka, allowing background workers to process it without blocking the user.',
    complexityOrMetric: 'Decoupled asynchronous processing · High-throughput log partitions',
    relatedWords: ['Microservices', 'Event-Driven', 'Kafka', 'Redis'],
  },
  {
    id: 'sys-microservices',
    term: 'Microservices vs Monolith',
    fullForm: 'Distributed Service Architecture vs Single-Process Application',
    domain: 'Systems & Cloud',
    importance: 'essential',
    plainMeaning:
      'A monolith packages all features into one large codebase; a microservices architecture splits features into independent smaller programs that communicate over the network via APIs.',
    techArchitecture:
      'Microservices deploy independently via containers (Docker/Kubernetes), communicate via gRPC/REST, maintain independent databases, and require distributed tracing and service meshes.',
    realWorldExample:
      'Splitting a streaming platform into separate services: Authentication Service, Video Transcoder Service, Recommendation Engine, and Payment Gateway.',
    complexityOrMetric: 'Independent deployment vs Network overhead & partial failures',
    relatedWords: ['API Gateway', 'Docker', 'Kubernetes', 'gRPC'],
  },
  {
    id: 'sys-circuit-breaker',
    term: 'Circuit Breaker Pattern',
    fullForm: 'Distributed System Fault Isolation (Closed, Open, Half-Open)',
    domain: 'Systems & Cloud',
    importance: 'essential',
    plainMeaning:
      'A safety pattern that automatically trips and stops sending requests to a failing server, preventing a cascade of crashes and giving the broken service time to recover.',
    techArchitecture:
      'States: Closed (normal flow) → Open (failure threshold reached, fail immediately without calling service) → Half-Open (send probe requests to test recovery).',
    realWorldExample:
      'If an AI transcription service goes down, the circuit breaker trips immediately, returning a cached summary instead of letting all user requests freeze and time out.',
    complexityOrMetric: 'Prevents cascading failures in distributed architectures',
    relatedWords: ['Rate Limiting', 'Fault Tolerance', 'Microservices'],
  },
  {
    id: 'sys-rate-limiting',
    term: 'Rate Limiting',
    fullForm: 'Token Bucket & Leaky Bucket Traffic Throttling',
    domain: 'Systems & Cloud',
    importance: 'essential',
    plainMeaning:
      'Controlling how many requests a user or client can send to an API in a given period of time, preventing abuse, server crashes, and denial-of-service attacks.',
    techArchitecture:
      'Implemented via algorithms like Token Bucket, Leaky Bucket, or Redis Sliding Window. Returns HTTP 429 Too Many Requests when limits are exceeded.',
    realWorldExample:
      'Restricting free API accounts to a maximum of 60 requests per minute to ensure fair resource allocation for all users.',
    complexityOrMetric: 'Token Bucket · Leaky Bucket · HTTP 429 Status',
    relatedWords: ['Circuit Breaker', 'DDoS', 'API Gateway'],
  },
  {
    id: 'sys-raft',
    term: 'Raft Consensus',
    fullForm: 'Distributed State Machine Replication Algorithm',
    domain: 'Systems & Cloud',
    importance: 'essential',
    plainMeaning:
      'An understandable algorithm that allows a group of separate computer servers to agree on the exact same log of events, even when some servers crash or network links break.',
    techArchitecture:
      'Divides consensus into Leader Election (randomized election timers), Log Replication (leader appends entries and replicates to followers), and Safety (quorum commit requires (N/2)+1 votes).',
    realWorldExample:
      'Kubernetes and etcd using Raft to ensure 3 or 5 master nodes agree on cluster configuration without split-brain conflicts.',
    complexityOrMetric: 'Tolerates F failures with 2F + 1 nodes',
    relatedWords: ['CAP Theorem', 'Fault Tolerance', 'ZooKeeper'],
  },
  {
    id: 'sys-sharding',
    term: 'Database Sharding',
    fullForm: 'Horizontal Data Partitioning across Multiple Database Nodes',
    domain: 'Systems & Cloud',
    importance: 'essential',
    plainMeaning:
      'Splitting a huge database table across multiple physical database servers so each machine only stores a slice of the data, overcoming single-machine storage and CPU limits.',
    techArchitecture:
      'Routes queries using a Shard Key via Range-Based Partitioning or Hash-Based Partitioning (Consistent Hashing), routing reads/writes to the corresponding database node.',
    realWorldExample:
      'Sharding a billion-user database by user ID so users 1–10M live on Server A, 10M–20M on Server B, etc.',
    complexityOrMetric: 'Linear storage scaling · Avoids cross-shard joins',
    relatedWords: ['Consistent Hashing', 'Replication', 'Horizontal Scaling'],
  },

  // ================= COMPUTER SCIENCE & CSE SUBJECTS =================
  // Operating Systems (OS)
  {
    id: 'cse-process-thread',
    term: 'Process & Thread',
    fullForm: 'OS Execution Context & Lightweight Execution Units',
    domain: 'CSE & Algorithms',
    importance: 'essential',
    plainMeaning:
      'A process is an independent running program with its own private virtual memory; threads are lightweight execution paths inside the same process that share its memory and open files.',
    techArchitecture:
      'Processes have distinct Page Tables, File Descriptors, and Process Control Blocks (PCB). Sibling threads share the text and heap segments but maintain private registers, Program Counters, and call stacks.',
    realWorldExample:
      'A web browser process spawning separate worker threads to parse subtitles, render animations, and stream audio concurrently.',
    complexityOrMetric: 'Thread switch cost: ~1-2µs vs Process switch: ~5-10µs',
    relatedWords: ['Concurrency', 'Context Switch', 'Mutex', 'Virtual Memory'],
  },
  {
    id: 'cse-mutex-semaphore',
    term: 'Mutex & Semaphore',
    fullForm: 'Mutual Exclusion Lock & Counting Synchronization Primitive',
    domain: 'CSE & Algorithms',
    importance: 'essential',
    plainMeaning:
      'Synchronization tools used in multi-threaded programming to ensure that only one thread at a time can modify shared data, preventing bugs, data corruption, and race conditions.',
    techArchitecture:
      'Mutex is a binary ownership lock (acquire/release). A Semaphore maintains an atomic integer counter with wait() (P) and signal() (V) operations, allowing a fixed number of threads to access a resource.',
    realWorldExample:
      'Ensuring two threads don’t withdraw money from the same bank account at the exact same microsecond.',
    complexityOrMetric: 'Atomic Test-and-Set / Compare-and-Swap (CAS) instructions',
    relatedWords: ['Race Condition', 'Deadlock', 'Process & Thread'],
  },
  {
    id: 'cse-deadlock',
    term: 'Deadlock',
    fullForm: 'Four Coffman Conditions (Mutual Exclusion, Hold & Wait, No Preemption, Circular Wait)',
    domain: 'CSE & Algorithms',
    importance: 'essential',
    plainMeaning:
      'A freeze state where two or more threads are permanently stuck waiting for resources held by each other, so none of them can ever make progress.',
    techArchitecture:
      'Occurs when all 4 Coffman conditions hold simultaneously. Prevented by strict resource ordering hierarchies, lock timeouts, or Banker’s Algorithm.',
    realWorldExample:
      'Thread A holds Lock 1 and waits for Lock 2, while Thread B holds Lock 2 and waits for Lock 1: neither can proceed.',
    complexityOrMetric: 'Resource Allocation Graph cycle detection',
    relatedWords: ['Mutex & Semaphore', 'Race Condition', 'Starvation'],
  },
  {
    id: 'cse-virtual-memory',
    term: 'Virtual Memory & Paging',
    fullForm: 'Memory Management Unit (MMU), Page Tables & TLB',
    domain: 'CSE & Algorithms',
    importance: 'essential',
    plainMeaning:
      'An operating system mechanism that provides each program with the illusion of a massive, contiguous block of private memory, mapping virtual addresses to physical RAM chips behind the scenes.',
    techArchitecture:
      'Divides address space into fixed-size Pages (typically 4KB). The hardware MMU and TLB (Translation Lookaside Buffer) translate Virtual Addresses to Physical Addresses via multi-level Page Tables; unmapped pages trigger Page Faults to swap from disk.',
    realWorldExample:
      'Preventing a bug or crash in one app from corrupting the memory of another running program.',
    complexityOrMetric: 'TLB hit ~1ns · Page Fault interrupt ~5-10ms (disk swap)',
    relatedWords: ['TLB', 'Process & Thread', 'Heap & Stack'],
  },
  {
    id: 'cse-kernel-syscall',
    term: 'Kernel & System Call',
    fullForm: 'Privileged Ring 0 Execution & Trap Interface (Syscall)',
    domain: 'CSE & Algorithms',
    importance: 'essential',
    plainMeaning:
      'The kernel is the core supervisor program of an OS that controls the CPU, RAM, and hardware; a system call is the programmatic request an application makes to ask the kernel to perform a privileged action like reading a file or sending network packets.',
    techArchitecture:
      'Executes via CPU hardware privilege transitions (x86 sysenter/syscall instruction) switching CPU from User Mode (Ring 3) to Supervisor Mode (Ring 0), saving registers and executing validated kernel routines.',
    realWorldExample:
      'When your JavaScript code calls fetch() or fs.readFile(), it executes the open() and write() system calls in the OS kernel.',
    complexityOrMetric: 'User-space to kernel-space context switch',
    relatedWords: ['Context Switch', 'Process & Thread', 'Device Driver'],
  },

  // DBMS & Storage Systems
  {
    id: 'cse-acid',
    term: 'ACID Properties',
    fullForm: 'Atomicity, Consistency, Isolation, Durability (RDBMS)',
    domain: 'Systems & Cloud',
    importance: 'essential',
    plainMeaning:
      'The four gold-standard guarantees that ensure database transactions are processed reliably, even during power cuts, network crashes, or hardware errors.',
    techArchitecture:
      'Atomicity: all operations succeed or all rollback; Consistency: data respects constraints; Isolation: concurrent transactions execute without interference (via MVCC or 2PL); Durability: committed writes survive crashes via Write-Ahead Logging (WAL).',
    realWorldExample:
      'Transferring $100 from Account A to Account B: either both deduction and credit complete together, or neither happens if power fails mid-transaction.',
    complexityOrMetric: 'Write-Ahead Log (WAL) · Two-Phase Locking / MVCC',
    relatedWords: ['SQL', 'Database Index', 'B-Tree & B+ Tree', 'Transaction'],
  },
  {
    id: 'cse-btree',
    term: 'B-Tree & B+ Tree',
    fullForm: 'Self-Balancing Multiway Search Tree Index Structure',
    domain: 'CSE & Algorithms',
    importance: 'essential',
    plainMeaning:
      'The foundational data structure powering virtually all relational databases (like PostgreSQL and MySQL) that keeps data sorted and allows searches, inserts, and range queries in logarithmic time.',
    techArchitecture:
      'Unlike binary trees, B-Tree nodes store hundreds of keys per block, matching disk page boundaries to minimize slow disk I/O operations. In a B+ Tree, all data records are stored exclusively in leaf nodes linked as a doubly-linked list.',
    realWorldExample:
      'Finding 1 specific user row out of 100,000,000 rows in just 3 disk seeks.',
    complexityOrMetric: 'Search, Insert, Delete: O(log_B N) disk seeks',
    relatedWords: ['Database Index', 'ACID Properties', 'Binary Search'],
  },
  {
    id: 'cse-db-index',
    term: 'Database Index',
    fullForm: 'Primary Key, Clustered Index & Secondary B-Tree Index',
    domain: 'Systems & Cloud',
    importance: 'essential',
    plainMeaning:
      'A separate lookup data structure (like the index at the back of a textbook) that allows database queries to find specific records instantly without scanning through millions of rows line-by-line.',
    techArchitecture:
      'Replaces O(N) full table scans with O(log N) tree traverses. Indexes speed up SELECT queries with WHERE/JOIN clauses, but add slight overhead to INSERT, UPDATE, and DELETE operations.',
    realWorldExample:
      'Searching for a video transcript by videoId in 2 milliseconds rather than scanning every video ever created.',
    complexityOrMetric: 'O(log N) index seek vs O(N) full table scan',
    relatedWords: ['B-Tree & B+ Tree', 'SQL', 'ACID Properties'],
  },
  {
    id: 'cse-normalization',
    term: 'Normalization & Denormalization',
    fullForm: 'Relational Database Schema Design (1NF, 2NF, 3NF, BCNF)',
    domain: 'Systems & Cloud',
    importance: 'essential',
    plainMeaning:
      'Normalization organizes database tables to eliminate duplicate data and prevent inconsistencies; denormalization selectively duplicates data to make reading data faster by avoiding complex joins.',
    techArchitecture:
      'Follows formal normal forms (First Normal Form to Boyce-Codd Normal Form) using Foreign Keys. Denormalization is applied in read-heavy applications, OLAP data warehouses, and NoSQL stores.',
    realWorldExample:
      'Storing author names in a single Authors table rather than re-typing the full author bio next to every video.',
    complexityOrMetric: 'Normal Forms: 1NF → 2NF → 3NF → BCNF',
    relatedWords: ['SQL', 'ACID Properties', 'Database Index'],
  },

  // Compilers & Theory of Computation
  {
    id: 'cse-ast',
    term: 'Abstract Syntax Tree (AST)',
    fullForm: 'Hierarchical Syntactic Representation of Source Code',
    domain: 'CSE & Algorithms',
    importance: 'essential',
    plainMeaning:
      'A tree structure created by compilers and interpreters that represents the logical structure and grammar of programming code, stripping away punctuation like commas and parentheses.',
    techArchitecture:
      'Lexer converts raw source text into Tokens; Parser analyzes grammar (BNF) to construct the AST. Compilers then perform type checking, optimization passes, and code generation on the AST.',
    realWorldExample:
      'Babel, TypeScript compiler (tsc), and ESLint parsing code into an AST to detect syntax errors and rewrite modern JavaScript into older browser code.',
    complexityOrMetric: 'Source Code → Lexer (Tokens) → Parser (AST) → Bytecode / IR',
    relatedWords: ['Compiler & Interpreter', 'JIT Compilation', 'LLVM'],
  },
  {
    id: 'cse-compiler-jit',
    term: 'Compiler & JIT Compilation',
    fullForm: 'Just-In-Time Compilation (V8 Engine / JVM / LLVM)',
    domain: 'CSE & Algorithms',
    importance: 'essential',
    plainMeaning:
      'A compiler translates high-level human programming code into machine instructions ahead of time; a Just-In-Time (JIT) compiler monitors running code and translates frequently used functions into blazing-fast machine code on the fly.',
    techArchitecture:
      'The V8 engine interprets JavaScript bytecode using Ignition, profiles execution hotspots, and compiles hot loops into optimized native machine code using the TurboFan optimizing compiler.',
    realWorldExample:
      'Making complex browser applications and video players run at near-native speeds directly in JavaScript.',
    complexityOrMetric: 'Interpreted Bytecode → Profile Hotspots → JIT Machine Code',
    relatedWords: ['Abstract Syntax Tree (AST)', 'Bytecode', 'LLVM'],
  },
  {
    id: 'cse-big-o',
    term: 'Big-O Notation',
    fullForm: 'Asymptotic Time and Space Complexity Analysis',
    domain: 'CSE & Algorithms',
    importance: 'essential',
    plainMeaning:
      'The mathematical language engineers use to describe how the execution time or memory consumption of an algorithm grows as the size of the input data increases.',
    techArchitecture:
      'Characterizes the upper bound of growth rate: O(1) constant, O(log N) logarithmic, O(N) linear, O(N log N) linearithmic (efficient sorts), O(N²) quadratic, O(2^N) exponential.',
    realWorldExample:
      'Binary search finding an item in 1 billion elements in only 30 steps (O(log N)), compared to a linear scan taking up to 1 billion steps (O(N)).',
    complexityOrMetric: 'Growth orders: O(1) < O(log N) < O(N) < O(N log N) < O(N²)',
    relatedWords: ['Binary Search', 'Quicksort', 'Data Structures'],
  },

  // Data Structures & Algorithms (DSA)
  {
    id: 'dsa-binary-search',
    term: 'Binary Search',
    fullForm: 'Logarithmic Divide-and-Conquer Search',
    domain: 'CSE & Algorithms',
    importance: 'essential',
    plainMeaning:
      'An efficient algorithm that finds a target value within a sorted list by repeatedly checking the middle element and cutting the remaining search area in half.',
    techArchitecture:
      'Operates on sorted arrays. Computes mid = low + (high - low) / 2. Eliminates half the search space per iteration, yielding logarithmic O(log N) worst-case time complexity.',
    realWorldExample:
      'Finding the exact timestamp of a spoken word in a sorted video transcript with 10,000 lines in only 14 comparisons.',
    complexityOrMetric: 'Time: O(log N) · Space: O(1)',
    relatedWords: ['Big-O Notation', 'B-Tree & B+ Tree', 'Quicksort'],
  },
  {
    id: 'dsa-quicksort',
    term: 'Quicksort & Mergesort',
    fullForm: 'Divide-and-Conquer Sorting Algorithms',
    domain: 'CSE & Algorithms',
    importance: 'essential',
    plainMeaning:
      'Quicksort picks a pivot element and partitions the array into smaller and larger values; Mergesort divides the list in half, sorts each half recursively, and merges them back together.',
    techArchitecture:
      'Quicksort average time is O(N log N) with small constant factors and in-place cache efficiency. Mergesort guarantees O(N log N) worst-case time with stable sorting, requiring O(N) auxiliary space.',
    realWorldExample:
      'Sorting search results or ranking video chapters by viewer engagement in milliseconds.',
    complexityOrMetric: 'Time: O(N log N) · Quicksort in-place O(log N) stack',
    relatedWords: ['Big-O Notation', 'Binary Search', 'Divide and Conquer'],
  },
  {
    id: 'dsa-hash-table',
    term: 'Hash Table & Hash Map',
    fullForm: 'Constant-Time Key-Value Associative Array',
    domain: 'CSE & Algorithms',
    importance: 'essential',
    plainMeaning:
      'A data structure that maps keys to values using a mathematical hash function, allowing instant O(1) lookups, insertions, and deletions.',
    techArchitecture:
      'A Hash Function converts arbitrary keys into array indexes. Collisions are handled via Separate Chaining (linked lists or balanced trees) or Open Addressing (Linear/Quadratic Probing). Resizes when Load Factor exceeds threshold.',
    realWorldExample:
      'Looking up a user’s session token or caching video metadata by URL in O(1) constant time.',
    complexityOrMetric: 'Average Time: O(1) lookup, insert, delete',
    relatedWords: ['Caching & Redis', 'Database Index', 'Big-O Notation'],
  },
  {
    id: 'dsa-dp',
    term: 'Dynamic Programming',
    fullForm: 'Optimization over Overlapping Subproblems & Optimal Substructure',
    domain: 'CSE & Algorithms',
    importance: 'essential',
    plainMeaning:
      'An algorithmic technique that solves complex problems by breaking them into smaller overlapping subproblems, solving each subproblem once, and storing the answers in a table to avoid redundant calculations.',
    techArchitecture:
      'Applied via Memoization (top-down recursion with cache) or Tabulation (bottom-up iteration). Requires Optimal Substructure and Overlapping Subproblems properties.',
    realWorldExample:
      'Calculating the shortest driving route on GPS, or finding the Levenshtein edit distance between misheard words in subtitles.',
    complexityOrMetric: 'Turns exponential O(2^N) brute-force into polynomial O(N²)',
    relatedWords: ['Big-O Notation', 'Recursion', 'Graph & Dijkstra'],
  },
  {
    id: 'dsa-graph-dijkstra',
    term: 'Graph & Dijkstra’s Algorithm',
    fullForm: 'Shortest Path on Weighted Directed Graphs',
    domain: 'CSE & Algorithms',
    importance: 'essential',
    plainMeaning:
      'A graph represents a network of nodes connected by edges; Dijkstra’s algorithm finds the shortest, least expensive path between two nodes in that network.',
    techArchitecture:
      'Uses a Min-Priority Queue (Fibonacci or Binary Heap) to greedily extract the unvisited node with minimal tentative distance, relaxing neighbor edges.',
    realWorldExample:
      'Internet routers calculating the optimal path for network packets, and Google Maps finding the fastest route to your destination.',
    complexityOrMetric: 'Time: O((V + E) log V) with binary heap',
    relatedWords: ['Router & BGP', 'Dynamic Programming', 'Big-O Notation'],
  },

  // Computer Architecture & Hardware
  {
    id: 'hw-cpu-cache',
    term: 'CPU Cache (L1, L2, L3)',
    fullForm: 'SRAM Memory Hierarchy & Locality of Reference',
    domain: 'Hardware & Chips',
    importance: 'essential',
    plainMeaning:
      'Tiny, lightning-fast memory banks built directly inside the CPU chip to store the data and code the processor is using right now, avoiding slow trips to main RAM.',
    techArchitecture:
      'L1 Cache (~1ns latency, 32-64KB per core), L2 Cache (~3-5ns, 1-2MB), L3 Cache (~10-20ns, shared 32-128MB). Relies on Spatial Locality (data stored nearby) and Temporal Locality (data reused soon).',
    realWorldExample:
      'Keeping inner loops of audio decoders and matrix math inside L1 cache to maintain 60fps video playback without stutter.',
    complexityOrMetric: 'L1: ~1ns · L2: ~4ns · L3: ~12ns · Main RAM: ~60-80ns',
    relatedWords: ['GPU & CUDA', 'Virtual Memory & Paging', 'CPU Pipeline'],
  },
  {
    id: 'hw-gpu-cuda',
    term: 'GPU & CUDA',
    fullForm: 'Graphics Processing Unit & SIMD Parallel Computing Architecture',
    domain: 'Hardware & Chips',
    importance: 'essential',
    plainMeaning:
      'A specialized chip containing thousands of small, coordinated computing cores designed to perform simple mathematical operations (like matrix multiplication) simultaneously at enormous speed.',
    techArchitecture:
      'Employs SIMD (Single Instruction Multiple Data) and SIMT (Single Instruction Multiple Threads). NVIDIA CUDA exposes Tensor Cores and High-Bandwidth Memory (HBM3) to accelerate deep learning matrix math.',
    realWorldExample:
      'Training a neural network or rendering 3D graphics in minutes instead of taking weeks on a traditional CPU.',
    complexityOrMetric: 'TeraFLOPS to PetaFLOPS matrix multiplication throughput',
    relatedWords: ['CPU Cache (L1, L2, L3)', 'Neural Network', 'Transformer'],
  },
  {
    id: 'hw-pipeline',
    term: 'CPU Pipeline & Branch Prediction',
    fullForm: 'Instruction Pipelining & Speculative Execution',
    domain: 'Hardware & Chips',
    importance: 'essential',
    plainMeaning:
      'Pipelining allows a CPU to overlap different stages of multiple instructions at the same time (like an assembly line); branch prediction guesses which direction an `if-statement` will go before evaluating it.',
    techArchitecture:
      'Stages: Fetch → Decode → Execute → Memory Access → Writeback. Branch predictors use history tables; mispredictions trigger pipeline flushes costing 15-20 clock cycles.',
    realWorldExample:
      'Enabling modern CPUs to execute 3 to 5 instructions per clock cycle on every core.',
    complexityOrMetric: 'Deep pipelines: 14 to 20 stages · Instruction-Level Parallelism (ILP)',
    relatedWords: ['CPU Cache (L1, L2, L3)', 'GPU & CUDA', 'Process & Thread'],
  },

  // Cybersecurity & Cryptography
  {
    id: 'sec-encryption',
    term: 'Encryption & Hashing',
    fullForm: 'Symmetric/Asymmetric Ciphers (AES/RSA) & One-Way Hashes (SHA-256)',
    domain: 'Software Engineering',
    importance: 'essential',
    plainMeaning:
      'Encryption scrambles readable information so only people with the secret key can decrypt and read it; hashing scrambles data into a permanent one-way fingerprint that cannot be reversed.',
    techArchitecture:
      'Symmetric (AES-256) uses one shared key; Asymmetric (RSA/ECC) uses a Public Key to encrypt and Private Key to decrypt. Cryptographic hashes (SHA-256) are deterministic, avalanche-effect, and collision-resistant.',
    realWorldExample:
      'Storing hashed passwords with salt in a database so even if the database leaks, user passwords remain secure.',
    complexityOrMetric: '256-bit encryption key requires 2^256 operations to brute force',
    relatedWords: ['TLS / SSL', 'OAuth & JWT', 'Digital Signature'],
  },
  {
    id: 'sec-oauth-jwt',
    term: 'OAuth 2.0 & JWT',
    fullForm: 'Open Authorization & JSON Web Tokens (RFC 7519)',
    domain: 'Software Engineering',
    importance: 'essential',
    plainMeaning:
      'OAuth allows users to grant apps access to their accounts (like "Sign in with Google") without giving away their password; JWTs are digitally signed identity badges that prove who you are.',
    techArchitecture:
      'OAuth uses Authorization Codes exchanged for Access Tokens. A JWT consists of three Base64URL parts: Header.Payload.Signature signed with HMAC-SHA256 or RSA private keys for stateless authentication.',
    realWorldExample:
      'Logging into this applet with Google Sign-In and having the backend verify your identity cryptographically without ever touching your Google password.',
    complexityOrMetric: 'Stateless signature verification · Zero database lookups for Auth',
    relatedWords: ['Encryption & Hashing', 'TLS / SSL', 'REST & gRPC'],
  },

  // Software Engineering & Architecture
  {
    id: 'swe-solid',
    term: 'SOLID Principles',
    fullForm: 'Five Foundational Object-Oriented Software Design Principles',
    domain: 'Software Engineering',
    importance: 'essential',
    plainMeaning:
      'Five core guidelines that help engineers write clean, maintainable, and flexible code that is easy to extend without breaking existing features.',
    techArchitecture:
      'S: Single Responsibility (one reason to change); O: Open/Closed (open for extension, closed for modification); L: Liskov Substitution (subtypes must be substitutable); I: Interface Segregation (lean interfaces); D: Dependency Inversion (depend on abstractions).',
    realWorldExample:
      'Designing video player components so adding a new media player (like Vimeo or Podcast) requires zero changes to existing YouTube playback logic.',
    complexityOrMetric: 'Design maintainability · Modular decoupling',
    relatedWords: ['Design Patterns', 'Refactoring', 'Unit Testing & TDD'],
  },
  {
    id: 'swe-design-patterns',
    term: 'Design Patterns',
    fullForm: 'Reusable Engineering Solutions (Singleton, Factory, Observer, Adapter)',
    domain: 'Software Engineering',
    importance: 'essential',
    plainMeaning:
      'Standard, battle-tested solutions to common problems in software architecture that provide a shared vocabulary and robust structure for developers.',
    techArchitecture:
      'Categories: Creational (Singleton, Factory, Builder), Structural (Adapter, Decorator, Facade), Behavioral (Observer, Strategy, Command).',
    realWorldExample:
      'Using the Observer pattern so when a video reaches second 42, the subtitle viewer and word inspector automatically update in real time.',
    complexityOrMetric: 'Decoupled architecture · Reusable patterns',
    relatedWords: ['SOLID Principles', 'Software Architecture', 'OOP'],
  },
];

/**
 * Searches and ranks technical words for user queries.
 */
export function searchTechWordsHighGrade(
  query: string,
  entries: TechWordEntry[],
  domainFilter: string = 'all'
): TechWordEntry[] {
  let pool = entries;
  if (domainFilter !== 'all') {
    if (domainFilter === 'From This Video') {
      pool = entries.filter((e) => e.domain === 'From This Video' || e.contextInVideo !== undefined);
    } else {
      pool = entries.filter((e) => e.domain === domainFilter);
    }
  }

  const q = query.trim().toLowerCase();
  if (!q) return pool;

  const queryTokens = q.split(/\s+/).filter(Boolean);

  const scored: Array<{ entry: TechWordEntry; score: number }> = [];
  for (const entry of pool) {
    const termLower = entry.term.toLowerCase();
    const fullLower = (entry.fullForm || '').toLowerCase();
    const plainLower = entry.plainMeaning.toLowerCase();
    const archLower = entry.techArchitecture.toLowerCase();
    const exLower = entry.realWorldExample.toLowerCase();
    const relLower = entry.relatedWords.join(' ').toLowerCase();
    const domainLower = entry.domain.toLowerCase();

    let score = 0;

    if (termLower === q) score += 200;
    else if (termLower.startsWith(q)) score += 120;
    else if (termLower.includes(q)) score += 85;

    if (fullLower === q) score += 150;
    else if (fullLower.includes(q)) score += 75;

    if (relLower.includes(q)) score += 50;
    if (plainLower.includes(q)) score += 35;
    if (archLower.includes(q)) score += 30;
    if (exLower.includes(q)) score += 20;
    if (domainLower.includes(q)) score += 15;

    if (queryTokens.length > 1) {
      let matchedTokens = 0;
      for (const tok of queryTokens) {
        if (
          termLower.includes(tok) ||
          fullLower.includes(tok) ||
          plainLower.includes(tok) ||
          archLower.includes(tok) ||
          relLower.includes(tok)
        ) {
          matchedTokens++;
          score += 18;
        }
      }
      if (matchedTokens === queryTokens.length) {
        score += 45;
      }
    }

    if (score > 0) {
      scored.push({ entry, score });
    }
  }

  return scored.sort((a, b) => b.score - a.score).map((item) => item.entry);
}

/**
 * High-Coverage Technical Word Extraction Engine
 * Extracts EVERY word related to AI, tech, networking, CSE field, system design,
 * and CSE subjects from the video transcript and summary.
 *
 * CRITICAL RULE: Returns ONLY words that actually appear in this video!
 * Zero unmentioned default encyclopedia words are shown.
 */
export function getCombinedTechAndVideoWords(
  summaryMarkdown: string,
  videoTitle: string = '',
  transcriptSegments: ParsedSegment[] = []
): {
  videoMatchedWords: TechWordEntry[];
  allWords: TechWordEntry[];
} {
  // Combine all transcript segments, video title, and summary so no words are skipped
  const fullTranscriptText = transcriptSegments.map((s) => s.text).join(' ');
  const combinedText = `${videoTitle}\n${summaryMarkdown}\n${fullTranscriptText}`;
  const lowerCombined = combinedText.toLowerCase();

  const findSegmentMatch = (queries: string[]): { seconds: number; label: string; quote: string } | null => {
    if (!transcriptSegments || transcriptSegments.length === 0) return null;
    for (const q of queries) {
      if (!q || q.length < 2) continue;
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      const found = transcriptSegments.find((s) => regex.test(s.text));
      if (found) {
        return {
          seconds: found.start,
          label: found.formattedTime,
          quote: found.text.trim(),
        };
      }
    }
    return null;
  };

  const videoMatchedWords: TechWordEntry[] = [];
  const matchedTermKeys = new Set<string>();

  // 1. Scan against the Comprehensive Encyclopedia of Tech, AI, Networking & CSE terms
  for (const entry of TECH_WORDS_ENCYCLOPEDIA) {
    const baseTerm = entry.term.replace(/\(.*?\)/g, '').trim();
    const shortAcronym = entry.term.match(/\(([A-Z0-9-]+)\)/)?.[1];
    
    // Decompose compound terms (e.g. "Mutex & Semaphore" -> "Mutex", "Semaphore")
    const subParts = baseTerm
      .split(/\s+(?:&|\/|vs\.?)\s+/i)
      .map((p) => p.trim())
      .filter((p) => p.length >= 3);

    if (baseTerm.toLowerCase().includes(' vs ')) {
      const matchVs = baseTerm.match(/(.+?)\s+vs\.?\s+(.+)/i);
      if (matchVs) {
        subParts.push(matchVs[1].trim(), matchVs[2].trim());
      }
    }

    const searchCandidates = [
      baseTerm,
      ...subParts,
      shortAcronym,
      entry.fullForm,
    ].filter(Boolean) as string[];

    let isMentioned = false;
    for (const cand of searchCandidates) {
      if (cand.length < 2) continue;
      const escaped = cand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (regex.test(combinedText)) {
        isMentioned = true;
        break;
      }
    }

    if (isMentioned) {
      const segMatch = findSegmentMatch(searchCandidates);
      const enriched: TechWordEntry = {
        ...entry,
        contextInVideo: segMatch?.quote,
        timestampSeconds: segMatch?.seconds,
        formattedTime: segMatch?.label,
      };
      videoMatchedWords.push(enriched);
      matchedTermKeys.add(baseTerm.toLowerCase());
      if (shortAcronym) matchedTermKeys.add(shortAcronym.toLowerCase());
    }
  }

  // 2. Scan for Technical Discovery Terms across developer tools, protocols, CSE subjects & languages
  const EXTENDED_TECHNICAL_KEYWORDS: Array<{
    term: string;
    domain: TechWordEntry['domain'];
    fullForm?: string;
    plainMeaning: string;
    techArchitecture: string;
    realWorldExample: string;
    aliases?: string[];
  }> = [
    // Networking & Web
    {
      term: 'HTTP',
      fullForm: 'Hypertext Transfer Protocol',
      domain: 'Networking & Protocols',
      plainMeaning: 'The foundational stateless application protocol for distributed, collaborative, hypermedia information systems on the World Wide Web.',
      techArchitecture: 'Client-server request-response protocol running over TCP port 80/443.',
      realWorldExample: 'Web browsers fetching HTML, CSS, JavaScript, and video assets from servers.',
      aliases: ['http/1.1', 'http/2', 'https'],
    },
    {
      term: 'REST',
      fullForm: 'Representational State Transfer (Roy Fielding, 2000)',
      domain: 'Networking & Protocols',
      plainMeaning: 'A software architectural style for building scalable web APIs using standard HTTP methods like GET, POST, PUT, and DELETE.',
      techArchitecture: 'Stateless communication, uniform interface, cacheable responses, client-server decoupling.',
      realWorldExample: 'Calling GET /api/transcript to retrieve video subtitles in structured JSON format.',
      aliases: ['restful', 'rest api'],
    },
    {
      term: 'gRPC',
      fullForm: 'Google Remote Procedure Call (HTTP/2 & Protobuf)',
      domain: 'Networking & Protocols',
      plainMeaning: 'A high-performance, open-source universal RPC framework that allows client and server applications to communicate transparently.',
      techArchitecture: 'Runs over HTTP/2 multiplexed streams with binary serialization via Protocol Buffers.',
      realWorldExample: 'Low-latency microservices streaming data between backend servers in a cloud cluster.',
    },
    {
      term: 'GraphQL',
      fullForm: 'Query Language for APIs (Meta / GraphQL Foundation)',
      domain: 'Networking & Protocols',
      plainMeaning: 'A query language that lets clients request exactly the data they need and nothing more, preventing over-fetching.',
      techArchitecture: 'Type-safe schema defining Types, Queries, Mutations, and Subscriptions executed over single endpoint.',
      realWorldExample: 'A mobile app asking for only the title and thumbnail of 10 videos in a single network round-trip.',
    },
    {
      term: 'API Gateway',
      fullForm: 'Single Entry Point Reverse Proxy & Request Router',
      domain: 'Systems & Cloud',
      plainMeaning: 'A server that acts as the single front door for all client requests, routing traffic, enforcing security, and aggregating API responses.',
      techArchitecture: 'Handles authentication, TLS termination, rate limiting, telemetry, and load balancing across microservices.',
      realWorldExample: 'Routing /api/auth to Auth Service and /api/video to Video Service through an Envoy proxy.',
    },
    {
      term: 'Docker',
      fullForm: 'Linux Container Runtime & Image Packaging Engine',
      domain: 'Systems & Cloud',
      plainMeaning: 'A platform that packages software code and all its dependencies into standardized lightweight containers that run reliably anywhere.',
      techArchitecture: 'Leverages Linux kernel cgroups (resource limits) and namespaces (isolation) without hypervisor OS overhead.',
      realWorldExample: 'Shipping a Node.js transcription service in a Docker container that behaves identically on local laptops and cloud servers.',
      aliases: ['container', 'containers', 'containerization'],
    },
    {
      term: 'Kubernetes',
      fullForm: 'K8s Container Orchestration Engine',
      domain: 'Systems & Cloud',
      plainMeaning: 'An open-source system for automating deployment, scaling, and management of containerized applications.',
      techArchitecture: 'Control plane (API server, etcd, scheduler) orchestrating Worker Nodes running Kubelet and Pods.',
      realWorldExample: 'Auto-scaling from 5 to 50 video transcribing pods when viral traffic hits the platform.',
      aliases: ['k8s'],
    },
    {
      term: 'PostgreSQL',
      fullForm: 'Object-Relational Database Management System (ORDBMS)',
      domain: 'Systems & Cloud',
      plainMeaning: 'A powerful, open-source object-relational database system renowned for reliability, SQL feature robustness, and ACID compliance.',
      techArchitecture: 'Multi-Version Concurrency Control (MVCC), Write-Ahead Logging (WAL), B-Tree/GIN/GiST indexing, table partitioning.',
      realWorldExample: 'Storing persistent user accounts, video history, and knowledge artifacts with relational integrity.',
      aliases: ['postgres', 'pgsql'],
    },
    {
      term: 'Redis',
      fullForm: 'Remote Dictionary Server (In-Memory Key-Value Store)',
      domain: 'Systems & Cloud',
      plainMeaning: 'An ultra-fast in-memory data store used as a database, cache, message broker, and streaming engine.',
      techArchitecture: 'Single-threaded event loop executing non-blocking RAM operations with optional AOF/RDB persistence.',
      realWorldExample: 'Storing session tokens and caching computed video summaries for sub-millisecond retrieval.',
    },
    {
      term: 'Linear Algebra',
      fullForm: 'Vector Spaces, Matrices & Linear Transformations',
      domain: 'CSE & Algorithms',
      plainMeaning: 'The branch of mathematics concerning vector spaces and linear mappings between them, forming the computational core of all AI and computer graphics.',
      techArchitecture: 'Matrix multiplication W · x, eigenvalues, SVD decomposition, and dot products accelerated by SIMD and GPU tensor cores.',
      realWorldExample: 'Multiplying 784-pixel input vectors by weight matrices to detect image features.',
    },
    {
      term: 'Calculus & Chain Rule',
      fullForm: 'Multivariable Derivatives & Gradient Optimization',
      domain: 'CSE & Algorithms',
      plainMeaning: 'The mathematical technique that computes the derivative of a composite function, powering backpropagation in neural networks.',
      techArchitecture: '∂z/∂x = (∂z/∂y) · (∂y/∂x), allowing error gradients to propagate layer-by-layer backwards through deep networks.',
      realWorldExample: 'Adjusting weights in early layers of a deep network based on final output classification loss.',
      aliases: ['chain rule', 'derivative', 'gradient'],
    },
    {
      term: 'Git & Version Control',
      fullForm: 'Distributed Directed Acyclic Graph (DAG) Version Control',
      domain: 'Software Engineering',
      plainMeaning: 'A distributed version control system that tracks changes in source code over time, enabling collaboration among engineering teams.',
      techArchitecture: 'Content-addressable storage using SHA hashes as object keys (blobs, trees, commits, annotated tags).',
      realWorldExample: 'Branching, merging, and reverting code changes across team repositories without data loss.',
      aliases: ['git', 'github', 'version control'],
    },
    {
      term: 'CI/CD',
      fullForm: 'Continuous Integration & Continuous Deployment',
      domain: 'Software Engineering',
      plainMeaning: 'An automated engineering workflow where code changes are tested, built, and deployed to production automatically.',
      techArchitecture: 'Pipelines triggered by git pushes that run linters, unit tests, integration tests, and build artifacts.',
      realWorldExample: 'Pushing a bug fix to GitHub and having automated tests verify and deploy it to live servers in 3 minutes.',
      aliases: ['continuous integration', 'continuous deployment'],
    },
    {
      term: 'Linux',
      fullForm: 'Unix-Like Open Source Operating System Kernel',
      domain: 'CSE & Algorithms',
      plainMeaning: 'The foundational open-source operating system kernel that powers virtually all cloud servers, supercomputers, and Android devices.',
      techArchitecture: 'Monolithic kernel managing process scheduling, memory virtualization, device drivers, and POSIX system calls.',
      realWorldExample: 'Running web servers and AI training clusters with high stability, security, and low resource overhead.',
      aliases: ['unix', 'posix'],
    },
  ];

  for (const item of EXTENDED_TECHNICAL_KEYWORDS) {
    const cleanLower = item.term.toLowerCase();
    if (matchedTermKeys.has(cleanLower)) continue;

    const testCandidates = [item.term, item.fullForm, ...(item.aliases || [])].filter(Boolean) as string[];
    let hit = false;
    for (const cand of testCandidates) {
      if (cand.length < 2) continue;
      const escaped = cand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (regex.test(combinedText)) {
        hit = true;
        break;
      }
    }

    if (hit) {
      const segMatch = findSegmentMatch(testCandidates);
      matchedTermKeys.add(cleanLower);
      videoMatchedWords.push({
        id: `kw-${cleanLower.replace(/[^a-z0-9]+/g, '-')}`,
        term: item.term,
        fullForm: item.fullForm,
        domain: item.domain,
        importance: 'high',
        plainMeaning: item.plainMeaning,
        techArchitecture: item.techArchitecture,
        realWorldExample: item.realWorldExample,
        relatedWords: [],
        contextInVideo: segMatch?.quote,
        timestampSeconds: segMatch?.seconds,
        formattedTime: segMatch?.label,
      });
    }
  }

  // 3. Dynamic Transcript NER & Spoken Acronym Extractor
  // Extracts any spoken 2-6 letter technical acronyms (e.g., DNS, CPU, GPU, TCP, IP, API, DOM, CSS, HTML, VTT, etc.)
  const acronymRegex = /\b([A-Z0-9]{2,6})\b/g;
  let acrMatch;
  const commonNonTechWords = new Set([
    'THE', 'AND', 'FOR', 'NOT', 'YOU', 'ALL', 'CAN', 'HAD', 'HER', 'WAS', 'ONE', 'OUR', 'OUT',
    'DAY', 'GET', 'HAS', 'HIM', 'HIS', 'HOW', 'MAN', 'NEW', 'NOW', 'OLD', 'SEE', 'TWO', 'WAY',
    'WHO', 'BOY', 'DID', 'ITS', 'LET', 'PUT', 'SAY', 'SHE', 'TOO', 'USE', 'YES', 'WHY', 'BUT',
  ]);

  while ((acrMatch = acronymRegex.exec(combinedText)) !== null) {
    const acr = acrMatch[1];
    const acrLower = acr.toLowerCase();
    if (commonNonTechWords.has(acr) || matchedTermKeys.has(acrLower)) continue;

    // Check if appears in transcript segments as an exact capitalized token
    const segMatch = findSegmentMatch([acr]);
    if (segMatch) {
      matchedTermKeys.add(acrLower);
      videoMatchedWords.push({
        id: `acr-${acrLower}`,
        term: acr,
        fullForm: `${acr} (Technical Term / Acronym)`,
        domain: acr.includes('AI') || acr === 'ML' || acr === 'LLM'
          ? 'AI & Machine Learning'
          : acr.includes('NET') || acr === 'IP' || acr === 'DNS' || acr === 'TCP' || acr === 'UDP' || acr === 'HTTP' || acr === 'TLS'
          ? 'Networking & Protocols'
          : 'Software Engineering',
        importance: 'high',
        plainMeaning: `An important technical acronym or term referenced in the video at [${segMatch.label}].`,
        techArchitecture: `Spoken in context: "${segMatch.quote}".`,
        realWorldExample: segMatch.quote,
        relatedWords: [],
        contextInVideo: segMatch.quote,
        timestampSeconds: segMatch.seconds,
        formattedTime: segMatch.label,
      });
    }
  }

  // 4. Extract Terms & Principles from Crucial Knowledge Extractor (grounded in this video)
  const { terms: extractedVideoTerms } = extractCrucialKnowledge(
    summaryMarkdown,
    videoTitle,
    transcriptSegments
  );

  for (const vt of extractedVideoTerms) {
    const cleanTerm = vt.term.trim();
    const cleanLower = cleanTerm.toLowerCase();
    if (matchedTermKeys.has(cleanLower)) continue;
    matchedTermKeys.add(cleanLower);

    const segMatch = findSegmentMatch([vt.term, vt.fullForm || '']);

    let assignedDomain: TechWordEntry['domain'] = 'From This Video';
    const tagLower = (vt.tag || '').toLowerCase();
    const defLower = (vt.definition || '').toLowerCase();

    if (tagLower.includes('ai') || tagLower.includes('neural') || defLower.includes('model') || defLower.includes('learning')) {
      assignedDomain = 'AI & Machine Learning';
    } else if (tagLower.includes('network') || defLower.includes('protocol') || defLower.includes('packet')) {
      assignedDomain = 'Networking & Protocols';
    } else if (tagLower.includes('system') || defLower.includes('distributed') || defLower.includes('scale')) {
      assignedDomain = 'Systems & Cloud';
    } else if (tagLower.includes('algorithm') || defLower.includes('complexity') || defLower.includes('data structure')) {
      assignedDomain = 'CSE & Algorithms';
    } else if (tagLower.includes('hardware') || defLower.includes('chip') || defLower.includes('cpu') || defLower.includes('memory')) {
      assignedDomain = 'Hardware & Chips';
    } else if (tagLower.includes('software') || defLower.includes('code') || defLower.includes('program')) {
      assignedDomain = 'Software Engineering';
    }

    const videoEntry: TechWordEntry = {
      id: `video-term-${cleanLower.replace(/[^a-z0-9]+/g, '-')}`,
      term: vt.term,
      fullForm: vt.fullForm || vt.tag || undefined,
      domain: assignedDomain,
      importance: vt.importance === 'critical' ? 'essential' : 'high',
      plainMeaning: vt.definition,
      techArchitecture: vt.whyItMatters || vt.definition,
      realWorldExample: vt.realWorldExample || vt.contextInVideo || segMatch?.quote || vt.definition,
      complexityOrMetric: vt.tag || undefined,
      relatedWords: extractedVideoTerms
        .filter((other) => other.term !== vt.term)
        .slice(0, 4)
        .map((other) => other.term),
      contextInVideo: vt.contextInVideo || segMatch?.quote,
      timestampSeconds: vt.timestampSeconds ?? segMatch?.seconds,
      formattedTime: vt.formattedTime || segMatch?.label,
    };
    videoMatchedWords.push(videoEntry);
  }

  // 5. Spoken Definition Pattern Miner
  // Finds spoken phrases where speaker defines a term: e.g. "X is a ...", "we call this X", "known as X"
  for (const seg of transcriptSegments) {
    const text = seg.text.trim();
    // Pattern: "X is a/an/the..."
    const defPattern = /([A-Z][a-zA-Z0-9\s-]{2,28})\s+(?:is\s+(?:a|an|the)|means\s+(?:that|the)|refers\s+to\s+(?:a|the))\s+([^.?!]{15,180}[.?!])/g;
    let match;
    while ((match = defPattern.exec(text)) !== null) {
      const candidateTerm = match[1].trim();
      const candidateMeaning = match[2].trim();
      const termLower = candidateTerm.toLowerCase();
      if (
        termLower.length < 3 ||
        matchedTermKeys.has(termLower) ||
        /^(this|that|there|here|what|it|one|he|she|they|we|you)$/i.test(candidateTerm)
      ) {
        continue;
      }
      matchedTermKeys.add(termLower);
      videoMatchedWords.push({
        id: `mined-${termLower.replace(/[^a-z0-9]+/g, '-')}`,
        term: candidateTerm,
        domain: 'From This Video',
        importance: 'high',
        plainMeaning: candidateMeaning.charAt(0).toUpperCase() + candidateMeaning.slice(1),
        techArchitecture: `Spoken definition at [${seg.formattedTime}]: "${text}"`,
        realWorldExample: text,
        relatedWords: [],
        contextInVideo: text,
        timestampSeconds: seg.start,
        formattedTime: seg.formattedTime,
      });
      if (videoMatchedWords.length >= 80) break;
    }
  }

  // Sort video-matched words: items with video timestamps first (in chronological order), then others
  videoMatchedWords.sort((a, b) => {
    if (a.timestampSeconds !== undefined && b.timestampSeconds !== undefined) {
      return a.timestampSeconds - b.timestampSeconds;
    }
    if (a.timestampSeconds !== undefined) return -1;
    if (b.timestampSeconds !== undefined) return 1;
    return a.term.localeCompare(b.term);
  });

  // CRITICAL REQUIREMENT:
  // videoMatchedWords contains ONLY words that actually appear in this video!
  // allWords adds the broader encyclopedia for user-initiated search bar queries,
  // but when no query is typed, the UI strictly presents videoMatchedWords.
  const remainingEncyclopedia = TECH_WORDS_ENCYCLOPEDIA.filter(
    (e) => !matchedTermKeys.has(e.term.toLowerCase())
  );

  return {
    videoMatchedWords,
    allWords: [...videoMatchedWords, ...remainingEncyclopedia],
  };
}
