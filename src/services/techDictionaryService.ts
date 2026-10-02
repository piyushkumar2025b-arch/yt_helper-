import { TechWordEntry, ParsedSegment } from '../types';
import { extractCrucialKnowledge } from './knowledgeExtractionService';

export const TECH_WORDS_ENCYCLOPEDIA: TechWordEntry[] = [
  // ================= AI & MACHINE LEARNING =================
  {
    id: 'ai-transformer',
    term: 'Transformer',
    fullForm: 'Transformer Neural Network Architecture (Vaswani et al., 2017)',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'The foundational deep learning architecture behind modern Large Language Models (like Gemini, GPT-4, and Claude) that processes all words in a sequence in parallel and learns how every word relates to every other word.',
    techArchitecture:
      'Replaces recurrent (RNN/LSTM) sequential processing with stacked Multi-Head Self-Attention and Feed-Forward Network (FFN) layers, paired with Positional Encodings (such as RoPE), LayerNorm/RMSNorm, and residual connections.',
    realWorldExample:
      'When translating or summarizing a 50-page document, a Transformer attends directly to a pronoun at token 4,000 and links it to the subject introduced at token 12 without forgetting intermediate context.',
    complexityOrMetric: 'O(N²) standard self-attention time/memory with sequence length N',
    relatedWords: ['Self-Attention', 'LLM', 'KV Cache', 'FlashAttention', 'RoPE', 'Tokenization'],
  },
  {
    id: 'ai-self-attention',
    term: 'Self-Attention',
    fullForm: 'Scaled Dot-Product Self-Attention Mechanism',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'A mechanism that lets an AI model weigh the importance of every other word in a sentence when encoding a specific word, dynamically capturing context and nuance.',
    techArchitecture:
      'Projects input embeddings into Query (Q), Key (K), and Value (V) matrices. Computes attention weights via Softmax((Q · Kᵀ) / √d_k) · V across multiple parallel heads (Multi-Head Attention / Grouped-Query Attention).',
    realWorldExample:
      'In the sentence "The server crashed because it ran out of memory," self-attention assigns a high attention weight between "it" and "server" rather than "memory."',
    complexityOrMetric: 'Attention(Q,K,V) = softmax(QKᵀ / √d_k)V',
    relatedWords: ['Transformer', 'KV Cache', 'FlashAttention', 'Embeddings'],
  },
  {
    id: 'ai-llm',
    term: 'LLM',
    fullForm: 'Large Language Model',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'A massive neural network trained on trillions of words of text and code to understand, reason, summarize, write software, and answer complex questions.',
    techArchitecture:
      'Autoregressive decoder-only (or encoder-decoder) Transformer containing billions to trillions of parameters, pre-trained via next-token prediction (cross-entropy loss) and aligned via Supervised Fine-Tuning (SFT) and RLHF/DPO.',
    realWorldExample:
      'Models like Google Gemini, DeepSeek-R1, Claude 3.5 Sonnet, and Llama 3 generating structured multi-thousand-word video study guides or debugging TypeScript code.',
    complexityOrMetric: '7B to 1.8T+ parameters · Context windows up to 1M–2M tokens',
    relatedWords: ['Transformer', 'Tokenization', 'RLHF', 'RAG', 'Quantization', 'Inference'],
  },
  {
    id: 'ai-rag',
    term: 'RAG',
    fullForm: 'Retrieval-Augmented Generation',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'A technique that fetches verified facts, documents, or database records first and feeds them into an AI model’s prompt so its answer is accurate, up-to-date, and cited.',
    techArchitecture:
      'Splits external documents into chunks, encodes them into dense vector embeddings (plus sparse BM25 lexical indexes), retrieves top-K relevant passages via Approximate Nearest Neighbor (ANN / HNSW) search, re-ranks with a Cross-Encoder, and injects them into the LLM context window.',
    realWorldExample:
      'Searching 55+ live academic papers and injecting their abstracts into a video research assistant so every claim links to a real DOI or URL.',
    complexityOrMetric: 'O(log N) HNSW vector retrieval + Cross-Encoder reranking',
    relatedWords: ['Vector Database', 'Embeddings', 'Hallucination', 'LLM', 'Context Window'],
  },
  {
    id: 'ai-rlhf',
    term: 'RLHF',
    fullForm: 'Reinforcement Learning from Human Feedback',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'A post-training method where human reviewers rank different AI responses so the model learns to be helpful, accurate, and safe rather than just babbling internet text.',
    techArchitecture:
      'Trains a separate Reward Model (RM) on human preference pairs (chosen vs. rejected completions), then optimizes the LLM policy using Proximal Policy Optimization (PPO), Group Relative Policy Optimization (GRPO), or Direct Preference Optimization (DPO) with a KL-divergence penalty.',
    realWorldExample:
      'Teaching a pre-trained model to follow complex formatting instructions and refuse to fabricate harmful or broken code.',
    complexityOrMetric: 'PPO / DPO / GRPO alignment stages',
    relatedWords: ['LLM', 'Fine-Tuning', 'Chain-of-Thought', 'Hallucination'],
  },
  {
    id: 'ai-lora',
    term: 'LoRA',
    fullForm: 'Low-Rank Adaptation of Large Language Models',
    domain: 'AI & Machine Learning',
    importance: 'high',
    plainMeaning:
      'A fast, memory-saving way to fine-tune a giant AI model by freezing its original weights and training only tiny adapter layers on the side.',
    techArchitecture:
      'Decomposes weight update matrices ΔW ∈ ℝ^(d×k) into two low-rank matrices A ∈ ℝ^(d×r) and B ∈ ℝ^(r×k) where rank r ≪ min(d,k) (e.g., r=8 or 16), cutting trainable parameters by 99%+ and enabling QLoRA (4-bit base model + FP16 adapters).',
    realWorldExample:
      'Fine-tuning a 70B parameter open-weights model on medical or legal transcripts using a single GPU in a few hours.',
    complexityOrMetric: 'Reduces trainable parameters by ~1,000x (rank r = 8..64)',
    relatedWords: ['Fine-Tuning', 'Quantization', 'VRAM', 'LLM'],
  },
  {
    id: 'ai-quantization',
    term: 'Quantization',
    fullForm: 'Model Weight & Activation Precision Compression (FP16 → INT8 / INT4)',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'Shrinking an AI model’s memory footprint and speeding up inference by storing its numbers using fewer bits (like 4-bit or 8-bit integers instead of 16-bit or 32-bit decimals).',
    techArchitecture:
      'Maps high-precision floating-point weights (FP32/BF16) to lower-bit representations (INT8, INT4, FP8, NF4) using Post-Training Quantization (GPTQ, AWQ, GGUF) or Quantization-Aware Training (QAT) with per-channel scaling factors and zero-points.',
    realWorldExample:
      'Compressing a 70-billion-parameter model from 140 GB of VRAM (FP16) down to ~38 GB (4-bit AWQ/GGUF) with less than 1% perplexity loss.',
    complexityOrMetric: '2x–4x VRAM reduction & memory-bandwidth speedup',
    relatedWords: ['VRAM', 'Inference', 'LoRA', 'GPU', 'KV Cache'],
  },
  {
    id: 'ai-vector-db',
    term: 'Vector Database',
    fullForm: 'High-Dimensional Vector Similarity Search Engine (HNSW / IVF)',
    domain: 'AI & Machine Learning',
    importance: 'high',
    plainMeaning:
      'A specialized database that stores meanings as mathematical coordinates (vectors) so you can search by concept and similarity instead of exact keyword spelling.',
    techArchitecture:
      'Indexes dense float vectors (e.g., 768 or 1536 dimensions) using Hierarchical Navigable Small World (HNSW) graphs or Inverted File (IVF-PQ) product quantization to compute Cosine Similarity, Dot Product, or Euclidean (L2) distance in milliseconds.',
    realWorldExample:
      'Finding a video segment about "preventing server crashes" when the user searches for "high availability and fault tolerance."',
    complexityOrMetric: 'O(log N) Approximate Nearest Neighbor (ANN) query time',
    relatedWords: ['Embeddings', 'RAG', 'Database Sharding', 'Hash Table'],
  },
  {
    id: 'ai-embeddings',
    term: 'Embeddings',
    fullForm: 'Dense Semantic Vector Representations',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'Lists of numbers generated by a neural network that capture the deep meaning of a word, sentence, image, or audio clip so computers can compare how similar two ideas are.',
    techArchitecture:
      'Maps discrete tokens or multimodal inputs into a continuous d-dimensional vector space ℝ^d trained via contrastive learning (InfoNCE loss) so semantically related inputs cluster together with high cosine similarity cos(θ) = (A·B)/(‖A‖‖B‖).',
    realWorldExample:
      'The embedding vectors for "King - Man + Woman" land mathematically close to the vector for "Queen" in latent space.',
    complexityOrMetric: '768 to 3,072 float dimensions per embedding',
    relatedWords: ['Vector Database', 'RAG', 'Self-Attention', 'Tokenization'],
  },
  {
    id: 'ai-kv-cache',
    term: 'KV Cache',
    fullForm: 'Key-Value Attention Cache in Autoregressive Inference',
    domain: 'AI & Machine Learning',
    importance: 'high',
    plainMeaning:
      'A memory buffer used during AI text generation that saves the calculations for words already processed so the model doesn’t have to re-read the entire conversation for every new word it writes.',
    techArchitecture:
      'Caches past Key (K) and Value (V) tensors across all Transformer layers during autoregressive decoding, converting per-step generation complexity from O(N²) to O(N) at the cost of linear GPU VRAM growth (optimized via PagedAttention in vLLM and Multi-Query / Grouped-Query Attention).',
    realWorldExample:
      'Streaming a 4,000-word video summary at 80 tokens/second without slowing down as the output grows longer.',
    complexityOrMetric: 'Trades GPU VRAM for O(N) per-token decoding speed',
    relatedWords: ['Self-Attention', 'FlashAttention', 'VRAM', 'Inference'],
  },
  {
    id: 'ai-flash-attention',
    term: 'FlashAttention',
    fullForm: 'IO-Aware Exact Attention Algorithm (Dao et al.)',
    domain: 'AI & Machine Learning',
    importance: 'high',
    plainMeaning:
      'A hardware-optimized algorithm that makes AI attention calculations dramatically faster and uses far less memory by keeping data inside the GPU’s ultra-fast on-chip cache.',
    techArchitecture:
      'Uses tiling and online softmax rescaling to compute exact self-attention inside GPU SRAM without materializing the huge N×N attention matrix in slower High-Bandwidth Memory (HBM), reducing memory complexity from O(N²) to O(N).',
    realWorldExample:
      'Enabling LLMs to process 128K to 1M+ token context windows (entire books or 3-hour video transcripts) without running out of GPU memory.',
    complexityOrMetric: 'O(N) memory footprint instead of O(N²) HBM reads/writes',
    relatedWords: ['Self-Attention', 'GPU', 'HBM', 'KV Cache', 'Context Window'],
  },
  {
    id: 'ai-moe',
    term: 'Mixture of Experts (MoE)',
    fullForm: 'Sparse Mixture-of-Experts Neural Architecture',
    domain: 'AI & Machine Learning',
    importance: 'high',
    plainMeaning:
      'An AI design where a massive model is divided into many specialized sub-networks ("experts"), and a smart router activates only a few relevant experts for each word—giving giant-model intelligence at small-model speed.',
    techArchitecture:
      'Replaces dense Feed-Forward Network (FFN) layers with N expert sub-networks and a learned gating/routing network G(x) = Softmax(TopK(x·W_g)) that routes each token to the top-k (e.g., k=2 of 16) experts.',
    realWorldExample:
      'DeepSeek-V3/R1 and Mixtral 8x7B having hundreds of billions of total parameters while only activating a fraction of parameters per token generated.',
    complexityOrMetric: 'High total capacity (e.g. 671B) with low active FLOPs per token (e.g. 37B)',
    relatedWords: ['Transformer', 'LLM', 'Inference', 'GPU'],
  },
  {
    id: 'ai-cot',
    term: 'Chain-of-Thought (CoT)',
    fullForm: 'Step-by-Step Intermediate Reasoning Tokens',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'Allowing or prompting an AI model to "think out loud" step-by-step before giving its final answer, which dramatically improves accuracy on math, coding, and logic problems.',
    techArchitecture:
      'Allocates test-time compute by generating intermediate reasoning trajectories (either prompted or trained via Reinforcement Learning / GRPO as in OpenAI o1/o3, Gemini Thinking, and DeepSeek-R1) before emitting the final response token distribution.',
    realWorldExample:
      'Breaking down a complex distributed-systems race condition step-by-step before proposing the exact mutex lock fix.',
    complexityOrMetric: 'Scales reasoning accuracy with test-time compute tokens',
    relatedWords: ['LLM', 'RLHF', 'Agentic Workflow', 'Inference'],
  },
  {
    id: 'ai-tokenization',
    term: 'Tokenization (BPE)',
    fullForm: 'Subword Tokenization & Byte-Pair Encoding',
    domain: 'AI & Machine Learning',
    importance: 'high',
    plainMeaning:
      'How AI models chop raw text into bite-sized pieces called "tokens" (words, syllables, or characters) and convert them into numeric IDs before processing.',
    techArchitecture:
      'Algorithms like Byte-Pair Encoding (BPE, tiktoken) or Unigram SentencePiece iteratively merge the most frequent byte/character pairs into a fixed vocabulary (e.g., 32K to 256K token IDs), balancing sequence length against vocabulary matrix size.',
    realWorldExample:
      '1,000 English words typically correspond to ~1,330 tokens; common words like "apple" are 1 token, while rare technical identifiers split into subword chunks.',
    complexityOrMetric: '1 token ≈ 0.75 English words (~4 characters)',
    relatedWords: ['LLM', 'Embeddings', 'Transformer', 'Context Window'],
  },
  {
    id: 'ai-hallucination',
    term: 'Hallucination',
    fullForm: 'Unfaithful or Fabricated Generative Output',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'When an AI model confidently states a false fact, invents a fake citation, or guesses a non-existent software library because it is predicting plausible-sounding words rather than checking a database.',
    techArchitecture:
      'Stems from probabilistic next-token sampling over compressed parametric memory without epistemic uncertainty calibration; mitigated via Retrieval-Augmented Generation (RAG), tool grounding, temperature=0 greedy decoding, and citation verification.',
    realWorldExample:
      'An ungrounded LLM inventing a fake research paper title—solved by querying live OpenAlex/arXiv/Crossref APIs and verifying DOIs.',
    complexityOrMetric: 'Mitigated via RAG, Search Grounding & Citation Verification',
    relatedWords: ['RAG', 'LLM', 'RLHF', 'Agentic Workflow'],
  },
  {
    id: 'ai-agents',
    term: 'Agentic Workflow',
    fullForm: 'Autonomous Tool-Using & Multi-Step AI Agent Architecture',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'An AI system that doesn’t just reply once—it plans steps, calls external tools (like web search, compilers, or databases), checks its own work, and iterates until the goal is finished.',
    techArchitecture:
      'Combines an LLM reasoning loop (ReAct: Reason + Act) with structured function/tool calling, short-term working memory, long-term vector/episodic storage, and verification/reflection feedback loops.',
    realWorldExample:
      'An AI coding agent reading a codebase, running TypeScript lint checks, fixing a type error, and verifying the build passes.',
    complexityOrMetric: 'ReAct Loop: Thought → Tool Call → Observation → Verification',
    relatedWords: ['Chain-of-Thought (CoT)', 'RAG', 'LLM', 'API'],
  },
  {
    id: 'ai-diffusion',
    term: 'Diffusion Model',
    fullForm: 'Denoising Diffusion Probabilistic Model (DDPM / Latent Diffusion)',
    domain: 'AI & Machine Learning',
    importance: 'high',
    plainMeaning:
      'The AI technology behind modern image, video, and audio generators that learns to create crisp visuals by starting with pure random static (noise) and gradually sculpting it into a clear picture.',
    techArchitecture:
      'Learns to reverse a forward Markov Gaussian noising process using a U-Net or Diffusion Transformer (DiT) conditioned on text embeddings (CLIP/T5) inside a compressed Variational Autoencoder (VAE) latent space.',
    realWorldExample:
      'Generating high-resolution architectural diagrams or photorealistic scenes from a natural-language prompt.',
    complexityOrMetric: 'Iterative denoising over 4–50 sampling steps in latent space',
    relatedWords: ['Transformer', 'Embeddings', 'GPU'],
  },
  {
    id: 'ai-backprop',
    term: 'Backpropagation',
    fullForm: 'Backward Propagation of Errors & Automatic Differentiation',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'The core mathematical algorithm that teaches neural networks by measuring how wrong a prediction was and sending blame backward through every layer so each weight can be nudged in the right direction.',
    techArchitecture:
      'Applies the multivariable calculus Chain Rule (∂L/∂w_i = ∂L/∂y · ∂y/∂w_i) backward through a computational DAG (Autograd), storing intermediate activations during the forward pass to compute exact gradients for every parameter.',
    realWorldExample:
      'Updating billions of neural network weights during training after comparing predicted tokens against actual ground-truth text.',
    complexityOrMetric: 'O(W) time & activation memory per training step',
    relatedWords: ['Gradient Descent', 'Transformer', 'GPU'],
  },
  {
    id: 'ai-gradient-descent',
    term: 'Gradient Descent (AdamW)',
    fullForm: 'Stochastic Gradient Descent & Adaptive Moment Optimization',
    domain: 'AI & Machine Learning',
    importance: 'essential',
    plainMeaning:
      'An optimization method that trains AI models by repeatedly taking small steps "downhill" on an error landscape until the model’s mistakes are as small as possible.',
    techArchitecture:
      'Updates parameters θ ← θ - η·∇L(θ). Modern LLM training uses AdamW, which tracks exponential moving averages of first moments (momentum m_t) and second moments (per-parameter variance v_t) with decoupled weight decay regularization.',
    realWorldExample:
      'Using a cosine learning rate schedule with AdamW to stably train a deep neural network without exploding or vanishing gradients.',
    complexityOrMetric: 'θ_{t+1} = θ_t - η · (m̂_t / (√v̂_t + ε) + λθ_t)',
    relatedWords: ['Backpropagation', 'LLM', 'Fine-Tuning'],
  },

  // ================= CSE & ALGORITHMS =================
  {
    id: 'cse-big-o',
    term: 'Big-O Complexity',
    fullForm: 'Asymptotic Time & Space Complexity Notation',
    domain: 'CSE & Algorithms',
    importance: 'essential',
    plainMeaning:
      'A mathematical way computer scientists describe how much slower an algorithm gets or how much more memory it needs as the input data grows from 10 items to 10 million items.',
    techArchitecture:
      'Upper-bounds the growth rate of operations f(n) as input size n → ∞: O(1) constant (hash lookup), O(log n) logarithmic (binary search), O(n) linear (single pass), O(n log n) log-linear (MergeSort/QuickSort), O(n²) quadratic (nested loops / standard attention), O(2ⁿ) exponential.',
    realWorldExample:
      'Replacing an O(n²) nested array `.find()` loop with an O(1) `Map`/`Set` lookup so a 50,000-segment transcript renders in 4ms instead of freezing the browser for 12 seconds.',
    complexityOrMetric: 'O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(2ⁿ)',
    relatedWords: ['Hash Table', 'Binary Search', 'Dynamic Programming', 'Graph Traversal'],
  },
  {
    id: 'cse-dp',
    term: 'Dynamic Programming (DP)',
    fullForm: 'Optimal Substructure & Overlapping Subproblems (Memoization / Tabulation)',
    domain: 'CSE & Algorithms',
    importance: 'essential',
    plainMeaning:
      'Solving a hard problem by breaking it into smaller sub-problems, solving each sub-problem just once, and saving the answers in a table so you never recompute the same work twice.',
    techArchitecture:
      'Applies to problems exhibiting Optimal Substructure and Overlapping Subproblems. Implemented top-down via recursion + Memoization cache, or bottom-up via iterative state-transition table (e.g., Viterbi decoding, Levenshtein edit distance, Bellman-Ford, Knapsack).',
    realWorldExample:
      'Computing the minimum edit distance (diff) between two transcript versions or finding the highest-probability token sequence in speech recognition.',
    complexityOrMetric: 'Reduces exponential O(2ⁿ) recursion to polynomial O(n·m) time',
    relatedWords: ['Big-O Complexity', 'Recursion', 'Graph Traversal', 'Hash Table'],
  },
  {
    id: 'cse-hash-table',
    term: 'Hash Table',
    fullForm: 'Hash Map & Associative Array with Collision Resolution',
    domain: 'CSE & Algorithms',
    importance: 'essential',
    plainMeaning:
      'A data structure that stores key-value pairs using a mathematical "hash function" to jump straight to the exact memory slot in a single step, regardless of how many million items are stored.',
    techArchitecture:
      'Applies a deterministic hash function h(k) mod M to map keys to bucket indices, resolving hash collisions via Separate Chaining (linked lists/trees) or Open Addressing (Robin Hood / linear probing) and resizing when load factor α = n/M exceeds ~0.75.',
    realWorldExample:
      'JavaScript `Map`/`Set`, Python `dict`, Redis in-memory key-value stores, and database hash indexes performing instant O(1) lookups.',
    complexityOrMetric: 'O(1) average lookup/insert/delete · O(n) worst-case collision',
    relatedWords: ['Big-O Complexity', 'Consistent Hashing', 'Bloom Filter', 'Cache Locality'],
  },
  {
    id: 'cse-binary-search-btree',
    term: 'Binary Search & B-Trees',
    fullForm: 'Logarithmic Divide-and-Conquer Search & Self-Balancing Database Trees',
    domain: 'CSE & Algorithms',
    importance: 'essential',
    plainMeaning:
      'Finding an item in a sorted collection by repeatedly cutting the search space in half—allowing you to find 1 item out of 1 billion in just 30 checks.',
    techArchitecture:
      'Binary search compares target against the midpoint `mid = low + ((high - low) >> 1)` in sorted arrays. On disk/databases, B+ Trees generalize this to high-fanout nodes (100–1,000 keys per 4KB–16KB page) to minimize disk/SSD I/O seeks and support fast range scans.',
    realWorldExample:
      'Locating the exact video transcript caption at timestamp `01:42:15` out of 10,000 sorted segments in 14 comparisons, or indexing rows in PostgreSQL/Firestore.',
    complexityOrMetric: 'O(log₂ N) comparisons · B+ Tree height ≤ 3–4 for billions of rows',
    relatedWords: ['Big-O Complexity', 'Database Sharding', 'Cache Locality'],
  },
  {
    id: 'cse-graph-traversal',
    term: 'Graph Traversal (BFS / DFS / Dijkstra)',
    fullForm: 'Breadth-First Search, Depth-First Search & Shortest-Path Algorithms',
    domain: 'CSE & Algorithms',
    importance: 'essential',
    plainMeaning:
      'Algorithms for exploring networks of connected nodes—like web pages, social networks, citation graphs, road maps, or code dependency trees.',
    techArchitecture:
      'BFS uses a FIFO Queue to explore level-by-level (shortest path in unweighted graphs); DFS uses a LIFO Stack/recursion for cycle detection and topological sorting; Dijkstra & A* use a Priority Queue (Min-Heap) to find shortest weighted paths in O((V + E) log V).',
    realWorldExample:
      'Tracing academic paper citation networks, resolving npm package dependencies, or navigating HNSW vector search graphs.',
    complexityOrMetric: 'O(V + E) for BFS/DFS · O((V + E) log V) for Dijkstra',
    relatedWords: ['Big-O Complexity', 'Dynamic Programming', 'Vector Database'],
  },
  {
    id: 'cse-concurrency-mutex',
    term: 'Deadlock, Mutex & Semaphore',
    fullForm: 'Mutual Exclusion Locks, Concurrency Primitives & Race Condition Prevention',
    domain: 'CSE & Algorithms',
    importance: 'high',
    plainMeaning:
      'Tools used in multi-threaded software to make sure two processes don’t overwrite the same memory at the same time (a race condition) or get stuck waiting on each other forever (a deadlock).',
    techArchitecture:
      'A Mutex enforces single-thread ownership of a critical section via hardware atomic instructions (`CAS` / Compare-And-Swap); a Semaphore maintains an atomic counter permitting N concurrent holders. Deadlock occurs when Coffman’s 4 conditions hold (Mutual Exclusion, Hold & Wait, No Preemption, Circular Wait).',
    realWorldExample:
      'Preventing two simultaneous API requests from double-charging a user account or corrupting an in-memory cache.',
    complexityOrMetric: 'Atomic CAS hardware primitives · Lock-free vs Blocking synchronization',
    relatedWords: ['ACID vs BASE', 'Idempotency', 'Operating System'],
  },
  {
    id: 'cse-virtual-memory',
    term: 'Virtual Memory & Paging',
    fullForm: 'MMU Address Translation, Page Tables & TLB Cache',
    domain: 'CSE & Algorithms',
    importance: 'high',
    plainMeaning:
      'An operating system trick that gives every running program the illusion that it has its own giant, private, continuous block of RAM, while safely mapping chunks ("pages") to physical memory chips.',
    techArchitecture:
      'The CPU Memory Management Unit (MMU) translates Virtual Addresses to Physical Addresses via multi-level Page Tables (typically 4KB or 2MB HugePages), accelerated by the hardware Translation Lookaside Buffer (TLB). Missing pages trigger a Page Fault exception.',
    realWorldExample:
      'Isolating browser tabs so a crash or memory bug in one tab cannot read or corrupt another tab’s memory space.',
    complexityOrMetric: '4KB standard pages · ~1ns TLB hit vs ~100ns page walk',
    relatedWords: ['Cache Locality', 'Garbage Collection', 'KV Cache'],
  },
  {
    id: 'cse-cache-locality',
    term: 'CPU Cache Locality (L1/L2/L3)',
    fullForm: 'Temporal & Spatial Memory Hierarchy Optimization',
    domain: 'CSE & Algorithms',
    importance: 'high',
    plainMeaning:
      'Organizing data in contiguous memory so the CPU can read it from its ultra-fast microscopic L1/L2 caches in 1 nanosecond instead of waiting 100 nanoseconds to fetch scattered data from main RAM.',
    techArchitecture:
      'CPUs fetch memory in 64-byte Cache Lines. Contiguous arrays (`Float32Array`, Rust `Vec`, C++ `std::vector`) exploit spatial locality and hardware prefetchers, whereas pointer-chasing linked lists suffer constant cache misses.',
    realWorldExample:
      'Why matrix multiplication and FlashAttention tile numbers into contiguous blocks that fit inside on-chip SRAM/L1 cache.',
    complexityOrMetric: 'L1 hit: ~1ns · L2: ~4ns · L3: ~12ns · Main DRAM: ~80–100ns',
    relatedWords: ['FlashAttention', 'Big-O Complexity', 'Virtual Memory'],
  },
  {
    id: 'cse-ast-compiler',
    term: 'AST & Compiler Pipeline',
    fullForm: 'Abstract Syntax Tree, Lexing, Parsing & JIT Compilation',
    domain: 'CSE & Algorithms',
    importance: 'high',
    plainMeaning:
      'How programming languages turn human-written source code into a structured tree of meaning (the AST) so it can be type-checked, optimized, and translated into fast machine code.',
    techArchitecture:
      'Source text → Lexer/Tokenizer (tokens) → Parser (Abstract Syntax Tree) → Semantic Analysis & Type Checker → Intermediate Representation (SSA IR like LLVM IR) → Optimizer → Native Machine Code or Bytecode + Just-In-Time (JIT) compilation (V8 TurboFan).',
    realWorldExample:
      'TypeScript (`tsc`) parsing `.tsx` files into an AST to verify every component prop type before Vite bundles the application.',
    complexityOrMetric: 'Lexer → Parser (AST) → SSA IR → Machine Code / JIT',
    relatedWords: ['WebAssembly (Wasm)', 'Garbage Collection', 'Recursion'],
  },
  {
    id: 'cse-garbage-collection',
    term: 'Garbage Collection (GC)',
    fullForm: 'Generational Mark-and-Sweep & Reference Counting Memory Management',
    domain: 'CSE & Algorithms',
    importance: 'high',
    plainMeaning:
      'An automatic memory manager in languages like JavaScript, Python, Go, and Java that finds objects your program is no longer using and frees up their RAM so your app doesn’t leak memory.',
    techArchitecture:
      'Uses Generational Hypothesis (most objects die young in Nursery/Eden space) combined with concurrent Tri-Color Mark-and-Sweep, Compacting/Copying collectors, or Reference Counting + cycle detectors to reclaim unreachable heap allocations.',
    realWorldExample:
      'V8’s Orinoco garbage collector automatically freeing temporary transcript arrays between video loads without manual `free()` calls.',
    complexityOrMetric: 'Young-gen minor GC (<1–2ms) vs Old-gen concurrent mark-sweep',
    relatedWords: ['Virtual Memory', 'AST & Compiler Pipeline', 'Cache Locality'],
  },

  // ================= SYSTEMS, CLOUD & ARCHITECTURE =================
  {
    id: 'sys-cap-theorem',
    term: 'CAP Theorem',
    fullForm: 'Consistency, Availability & Partition Tolerance (Brewer’s Theorem)',
    domain: 'Systems & Cloud',
    importance: 'essential',
    plainMeaning:
      'A fundamental law of distributed databases stating that when a network cable breaks between servers (a Partition), you must choose between returning 100% up-to-date data (Consistency) or staying online with slightly stale data (Availability).',
    techArchitecture:
      'In the presence of a network Partition (P), a distributed data store must trade off Linearizable Consistency (CP — e.g., Spanner, etcd, ZooKeeper using Raft/Paxos) against High Availability (AP — e.g., DynamoDB, Cassandra with eventual consistency). Extended by PACELC (even without partitions, systems trade Latency vs Consistency).',
    realWorldExample:
      'Firebase Firestore using local IndexedDB cache + real-time synchronization so the UI stays responsive offline and converges when reconnected.',
    complexityOrMetric: 'CP (Consistency + Partition) vs AP (Availability + Partition)',
    relatedWords: ['ACID vs BASE', 'Consensus (Raft & Paxos)', 'Database Sharding'],
  },
  {
    id: 'sys-acid-base',
    term: 'ACID vs BASE',
    fullForm: 'Atomicity, Consistency, Isolation, Durability vs Basically Available, Soft-State, Eventual Consistency',
    domain: 'Systems & Cloud',
    importance: 'essential',
    plainMeaning:
      'The two main philosophies for database reliability: ACID guarantees all-or-nothing bank-grade safety for every transaction, while BASE prioritizes massive scale and speed by letting copies sync up moments later.',
    techArchitecture:
      'ACID relies on Write-Ahead Logging (WAL), Multi-Version Concurrency Control (MVCC), and Serializable/Snapshot Isolation (plus 2-Phase Commit across nodes). BASE uses quorum reads/writes (R + W > N), vector clocks, or CRDTs for conflict-free eventual convergence.',
    realWorldExample:
      'Using ACID transactions for payment balances while using BASE eventual consistency for video view counters and social feed caches.',
    complexityOrMetric: 'MVCC & WAL durability vs Quorum (R + W > N) eventual convergence',
    relatedWords: ['CAP Theorem', 'Database Sharding', 'Idempotency'],
  },
  {
    id: 'sys-consensus-raft',
    term: 'Consensus (Raft & Paxos)',
    fullForm: 'Distributed State Machine Replication & Leader Election Protocols',
    domain: 'Systems & Cloud',
    importance: 'high',
    plainMeaning:
      'Algorithms that allow a cluster of separate servers to agree on a single truth and elect a leader even if some servers crash or messages get delayed.',
    techArchitecture:
      'Raft decomposes consensus into Leader Election (randomized heartbeat timeouts), Log Replication (append-entries RPC requiring a majority quorum ⌊N/2⌋ + 1), and Safety (only nodes with up-to-date committed logs can become leader).',
    realWorldExample:
      'Kubernetes (`etcd`), CockroachDB, and Google Spanner ensuring cluster configuration and transactions never split-brain when a node fails.',
    complexityOrMetric: 'Tolerates f failures with 2f + 1 nodes (Majority Quorum)',
    relatedWords: ['CAP Theorem', 'Kubernetes', 'ACID vs BASE'],
  },
  {
    id: 'sys-sharding',
    term: 'Database Sharding & Consistent Hashing',
    fullForm: 'Horizontal Partitioning Across Distributed Storage Nodes',
    domain: 'Systems & Cloud',
    importance: 'high',
    plainMeaning:
      'Splitting a massive database across dozens of machines so each server only holds a slice ("shard") of the users or records, allowing the system to scale to billions of rows.',
    techArchitecture:
      'Partitions data horizontally by shard key using Range Partitioning or Consistent Hashing Rings (with virtual nodes) so adding or removing a server only remaps O(K/N) keys rather than reshuffling the entire dataset.',
    realWorldExample:
      'Partitioning user artifacts and summaries by `ownerId` so queries scale horizontally across cloud storage nodes.',
    complexityOrMetric: 'Consistent Hashing remaps only ~1/N keys on node scale-out',
    relatedWords: ['Hash Table', 'CAP Theorem', 'Load Balancer'],
  },
  {
    id: 'sys-idempotency',
    term: 'Idempotency',
    fullForm: 'Deterministic Repeat-Safe API & Distributed Operation Execution',
    domain: 'Systems & Cloud',
    importance: 'essential',
    plainMeaning:
      'Designing an action or API request so that performing it once or accidentally clicking/retrying it 10 times produces the exact same safe result without creating duplicates.',
    techArchitecture:
      'Achieved via deterministic document IDs (e.g., `setDoc(doc(db, "summaries", `${uid}_${videoId}`))`) or client-generated `Idempotency-Key` headers stored atomically in a deduplication table with TTL.',
    realWorldExample:
      'Clicking "Save to Firebase" three times on the same video summary updates the single deterministic document `summary_${uid}_${videoId}` instead of creating three duplicate copies.',
    complexityOrMetric: 'f(f(x)) = f(x) — safe automatic network retries',
    relatedWords: ['ACID vs BASE', 'REST, GraphQL & gRPC', 'Circuit Breaker'],
  },
  {
    id: 'sys-load-balancer-cdn',
    term: 'Load Balancer, Reverse Proxy & CDN',
    fullForm: 'Layer 4 / Layer 7 Traffic Distribution & Edge Caching',
    domain: 'Systems & Cloud',
    importance: 'high',
    plainMeaning:
      'Traffic cops at the front of a website that spread incoming visitors evenly across healthy backend servers and serve cached files from data centers closest to the user.',
    techArchitecture:
      'Reverse proxies (NGINX, Envoy, Cloudflare) terminate TLS, mitigate DDoS, and route L4 (TCP/UDP) or L7 (HTTP) requests via Round-Robin, Least-Connections, or Consistent Hashing, while Anycast CDNs cache static/dynamic assets at 300+ global edge PoPs.',
    realWorldExample:
      'Serving video thumbnails and static bundles from a local edge node 8ms away while load-balancing `/api/*` calls across backend containers.',
    complexityOrMetric: 'Edge cache hit <15ms global latency',
    relatedWords: ['Kubernetes', 'Circuit Breaker', 'TCP/IP, QUIC & HTTP/3'],
  },
  {
    id: 'sys-circuit-breaker',
    term: 'Circuit Breaker & Rate Limiting',
    fullForm: 'Fault-Tolerant Cascade Prevention & Token Bucket Throttling',
    domain: 'Systems & Cloud',
    importance: 'high',
    plainMeaning:
      'Safety switches in software that automatically stop calling a slow or failing external API so one broken service doesn’t drag down your entire application.',
    techArchitecture:
      'A state machine (`Closed` → `Open` when error threshold exceeded → `Half-Open` probe after cooldown) paired with strict `AbortSignal.timeout()`, exponential backoff with jitter, and Token Bucket / Leaky Bucket rate limiters.',
    realWorldExample:
      'Querying 55+ live research APIs in parallel via `Promise.allSettled` with 4.5s timeouts so if one external service is slow, the other 54 return results immediately.',
    complexityOrMetric: 'Closed → Open (Fail Fast) → Half-Open Probe',
    relatedWords: ['Idempotency', 'Load Balancer', 'Microservices'],
  },
  {
    id: 'sys-docker-k8s',
    term: 'Docker & Kubernetes (K8s)',
    fullForm: 'OS-Level Container Virtualization & Declarative Cluster Orchestration',
    domain: 'Systems & Cloud',
    importance: 'high',
    plainMeaning:
      'Docker packages an app and all its exact dependencies into a lightweight portable container; Kubernetes automatically runs, scales, and heals thousands of those containers across cloud servers.',
    techArchitecture:
      'Containers isolate processes using Linux Kernel `namespaces` (PID, net, mount) and `cgroups` (CPU/RAM limits) atop layered UnionFS images, while Kubernetes runs a declarative control-plane reconciliation loop (`etcd`, API Server, Scheduler, Kubelet) managing Pods, Deployments, and Services.',
    realWorldExample:
      'Deploying a full-stack Node.js + Vite application onto Cloud Run / Kubernetes where instances auto-scale from 0 to 100 based on live traffic.',
    complexityOrMetric: 'Sub-second container startup vs minutes for full hypervisor VMs',
    relatedWords: ['Consensus (Raft & Paxos)', 'Load Balancer', 'Virtual Memory'],
  },
  {
    id: 'sys-grpc-graphql-rest',
    term: 'REST, GraphQL & gRPC',
    fullForm: 'Architectural API Protocols (JSON HTTP vs Typed Query Graph vs HTTP/2 Protobuf)',
    domain: 'Systems & Cloud',
    importance: 'high',
    plainMeaning:
      'The three primary ways software services talk to each other: REST uses standard web URLs and JSON, GraphQL lets clients ask for the exact fields they want, and gRPC uses ultra-fast binary messages between backend servers.',
    techArchitecture:
      'REST maps CRUD to HTTP verbs (`GET`, `POST`, `PUT`, `DELETE`) with stateless JSON payloads; GraphQL resolves client-specified AST selection sets over a single endpoint; gRPC multiplexes binary Protocol Buffers (`Protobuf`) streams over HTTP/2 with strict `.proto` code generation.',
    realWorldExample:
      'Using REST `/api/*` endpoints for browser-to-server requests and gRPC/RPC for high-throughput microservice-to-database communication.',
    complexityOrMetric: 'Protobuf binary serialization is ~3–10x smaller & faster than JSON',
    relatedWords: ['Idempotency', 'TCP/IP, QUIC & HTTP/3', 'OAuth 2.0 & JWT'],
  },
  {
    id: 'sys-oauth-jwt',
    term: 'OAuth 2.0, OIDC & JWT',
    fullForm: 'Open Authorization, OpenID Connect & Cryptographic JSON Web Tokens',
    domain: 'Systems & Cloud',
    importance: 'essential',
    plainMeaning:
      'The industry-standard security system that lets you "Sign in with Google" without ever sharing your password with the app, issuing a tamper-proof digital pass (JWT) to verify who you are.',
    techArchitecture:
      'OAuth 2.0 / OIDC exchanges an authorization grant for a signed JWT (`Header.Payload.Signature` signed via RS256/ES256 asymmetric keys) containing claims (`sub`/`uid`, `email`, `exp`, `aud`) verified statelessly by backend services and Firebase Security Rules (`request.auth.uid`).',
    realWorldExample:
      'Signing in with Google Popup Auth so Firebase Firestore rules cryptographically verify `request.auth.uid == resource.data.ownerId` on every read and write.',
    complexityOrMetric: 'Stateless cryptographic signature verification (RS256 / EdDSA)',
    relatedWords: ['Idempotency', 'CAP Theorem', 'REST, GraphQL & gRPC'],
  },
  {
    id: 'sys-wasm',
    term: 'WebAssembly (Wasm)',
    fullForm: 'Portable Low-Level Binary Instruction Format for Sandboxed Execution',
    domain: 'Systems & Cloud',
    importance: 'high',
    plainMeaning:
      'A technology that lets web browsers and cloud servers run heavy code written in C++, Rust, or Go at near-native computer speed inside a secure sandbox.',
    techArchitecture:
      'Stack-based virtual machine executing compact `.wasm` binary bytecode with linear memory isolation, validated and JIT/AOT-compiled to native CPU instructions in milliseconds.',
    realWorldExample:
      'Running video/audio codecs (FFmpeg), Figma’s rendering engine, SQLite, or local AI tokenizers directly inside the browser tab at native speed.',
    complexityOrMetric: 'Near-native 80–95% CPU execution speed in a memory-safe sandbox',
    relatedWords: ['AST & Compiler Pipeline', 'Cache Locality', 'Docker & Kubernetes (K8s)'],
  },

  // ================= HARDWARE, CHIPS & NETWORKING =================
  {
    id: 'hw-gpu-tensor-cores',
    term: 'GPU & Tensor Cores',
    fullForm: 'Massively Parallel Graphics Processing Unit & Matrix Multiply-Accumulate Units',
    domain: 'Hardware & Chips',
    importance: 'essential',
    plainMeaning:
      'A processor with thousands of cores built to do millions of math calculations at the exact same time—making it the engine behind both 3D graphics and modern AI training.',
    techArchitecture:
      'Whereas a CPU has 8–64 complex out-of-order cores optimized for serial branching latency, a modern GPU (e.g., NVIDIA H100/B200) packs thousands of SIMT (Single Instruction, Multiple Threads) cores and specialized Tensor Cores that execute 4×4 orlarger matrix multiply-accumulate (`D = A × B + C`) in FP16/BF16/FP8/INT8 in a single clock cycle.',
    realWorldExample:
      'Executing trillions of matrix multiplications per second to train or run inference on a Large Language Model.',
    complexityOrMetric: 'Up to 1,000–4,500+ TFLOPS of dense/sparse tensor compute',
    relatedWords: ['TPU', 'CUDA', 'VRAM & HBM', 'FlashAttention', 'Quantization'],
  },
  {
    id: 'hw-tpu-npu',
    term: 'TPU & NPU',
    fullForm: 'Tensor Processing Unit (Google ASIC) & Neural Processing Unit',
    domain: 'Hardware & Chips',
    importance: 'high',
    plainMeaning:
      'Custom-designed AI computer chips built from scratch specifically for neural network matrix math—TPUs power giant cloud data centers, while NPUs run AI efficiently on phones and laptops.',
    techArchitecture:
      'Uses a Systolic Array architecture where weights remain stationary in registers while activations flow rhythmically through a 2D grid of Multiply-Accumulate (MAC) units without touching registers or cache between operations, maximizing FLOPs/watt.',
    realWorldExample:
      'Google Cloud TPU v5p / Trillium pods training and serving Gemini models at massive scale with high energy efficiency.',
    complexityOrMetric: 'Systolic Array matrix pipeline · High FLOPs per Watt',
    relatedWords: ['GPU & Tensor Cores', 'VRAM & HBM', 'LLM', 'Quantization'],
  },
  {
    id: 'hw-vram-hbm',
    term: 'VRAM & HBM (High-Bandwidth Memory)',
    fullForm: 'Video Random-Access Memory & 3D-Stacked High-Bandwidth Memory (HBM3e)',
    domain: 'Hardware & Chips',
    importance: 'essential',
    plainMeaning:
      'Ultra-fast memory wired directly next to a GPU or AI chip; because AI models must read billions of weights for every single word generated, memory bandwidth is often the #1 speed bottleneck in AI.',
    techArchitecture:
      'HBM vertically stacks DRAM dies using Through-Silicon Vias (TSVs) on a silicon interposer with a massive 1024-bit+ bus width, delivering 3 TB/s to 8+ TB/s of memory bandwidth (compared to ~50–100 GB/s on standard DDR5 CPU RAM).',
    realWorldExample:
      'LLM token generation is "memory-bandwidth bound": doubling HBM bandwidth nearly doubles how many tokens per second a single user receives.',
    complexityOrMetric: '3.3 TB/s – 8 TB/s bandwidth on modern AI accelerators',
    relatedWords: ['GPU & Tensor Cores', 'Quantization', 'KV Cache', 'FlashAttention'],
  },
  {
    id: 'hw-cuda',
    term: 'CUDA',
    fullForm: 'Compute Unified Device Architecture (Parallel GPU Programming Model)',
    domain: 'Hardware & Chips',
    importance: 'high',
    plainMeaning:
      'The software platform and C++/Python programming toolkit created by NVIDIA that lets developers write code and AI kernels that run directly on GPU cores.',
    techArchitecture:
      'Organizes parallel execution into Grids → Thread Blocks → Warps (32 lockstep threads) sharing fast on-chip Shared Memory (SRAM), accompanied by cuBLAS, cuDNN, and Triton compiler ecosystems.',
    realWorldExample:
      'PyTorch compiling neural network operations into CUDA kernels so a single line of Python runs across 16,000 GPU cores.',
    complexityOrMetric: 'Grid → Block → 32-Thread Warp SIMT execution hierarchy',
    relatedWords: ['GPU & Tensor Cores', 'FlashAttention', 'VRAM & HBM'],
  },
  {
    id: 'hw-tcp-quic-http3',
    term: 'TCP/IP, QUIC & HTTP/3',
    fullForm: 'Transmission Control Protocol vs UDP-Based Multiplexed QUIC Transport',
    domain: 'Hardware & Chips',
    importance: 'high',
    plainMeaning:
      'The core networking rules that move data reliably across the internet—HTTP/3 and QUIC modernize the web by combining encryption and connection setup into a single step and eliminating packet stalls.',
    techArchitecture:
      'Classic TCP requires a 3-way handshake (`SYN`, `SYN-ACK`, `ACK`) plus separate TLS 1.3 negotiation and suffers from Head-of-Line (HoL) blocking when a single packet drops. QUIC (underlying HTTP/3) runs atop UDP with built-in TLS 1.3 (0-RTT / 1-RTT handshake) and independent per-stream loss recovery.',
    realWorldExample:
      'Streaming live video captions and API responses smoothly over mobile Wi-Fi without the entire page stalling when a single packet drops.',
    complexityOrMetric: '0-RTT / 1-RTT connection setup · Zero transport Head-of-Line blocking',
    relatedWords: ['Load Balancer, Reverse Proxy & CDN', 'REST, GraphQL & gRPC'],
  },
];

/**
 * Extracts all Tech, AI, CSE, and Crucial Words from the active video summary & transcript,
 * merging them with the curated Encyclopedia and attaching exact video timestamps & quotes.
 */
export function getCombinedTechAndVideoWords(
  summaryMarkdown: string,
  videoTitle: string = '',
  transcriptSegments: ParsedSegment[] = []
): {
  videoMatchedWords: TechWordEntry[];
  allWords: TechWordEntry[];
} {
  const combinedText = `${videoTitle}\n${summaryMarkdown}\n${transcriptSegments
    .slice(0, 150)
    .map((s) => s.text)
    .join(' ')}`;

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
  const matchedIds = new Set<string>();

  // 1. Check which Encyclopedia Tech/AI/CSE terms appear in this video
  for (const entry of TECH_WORDS_ENCYCLOPEDIA) {
    const baseTerm = entry.term.replace(/\(.*?\)/g, '').trim();
    const shortAcronym = entry.term.match(/\(([A-Z0-9-]+)\)/)?.[1];
    const searchCandidates = [baseTerm, shortAcronym, entry.fullForm].filter(Boolean) as string[];

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
      matchedIds.add(entry.id);
    }
  }

  // 2. Also pull video-specific important terms from extractCrucialKnowledge so any video's key terms appear!
  const { terms: extractedVideoTerms } = extractCrucialKnowledge(
    summaryMarkdown,
    videoTitle,
    transcriptSegments
  );

  for (const vt of extractedVideoTerms) {
    const alreadyExists = videoMatchedWords.some(
      (w) => w.term.toLowerCase() === vt.term.toLowerCase()
    );
    if (alreadyExists) continue;

    const segMatch = findSegmentMatch([vt.term, vt.fullForm || '']);
    const videoEntry: TechWordEntry = {
      id: `video-term-${vt.term.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      term: vt.term,
      fullForm: vt.fullForm || vt.tag || undefined,
      domain: 'From This Video',
      importance: vt.importance === 'critical' ? 'essential' : 'high',
      plainMeaning: vt.definition,
      techArchitecture:
        vt.whyItMatters ||
        vt.definition,
      realWorldExample:
        vt.realWorldExample ||
        vt.contextInVideo ||
        segMatch?.quote ||
        vt.definition,
      complexityOrMetric: vt.tag || undefined,
      relatedWords: extractedVideoTerms
        .filter((other) => other.term !== vt.term)
        .slice(0, 5)
        .map((other) => other.term),
      contextInVideo: vt.contextInVideo || segMatch?.quote,
      timestampSeconds: vt.timestampSeconds ?? segMatch?.seconds,
      formattedTime: vt.formattedTime || segMatch?.label,
    };
    videoMatchedWords.push(videoEntry);
  }

  // Combine video-matched words first, followed by the rest of the encyclopedia
  const remainingEncyclopedia = TECH_WORDS_ENCYCLOPEDIA.filter((e) => !matchedIds.has(e.id));
  return {
    videoMatchedWords,
    allWords: [...videoMatchedWords, ...remainingEncyclopedia],
  };
}

/**
 * High-grade multi-signal ranked search across all Tech, AI, CSE & Video words.
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

    // Exact or prefix match on term
    if (termLower === q) score += 200;
    else if (termLower.startsWith(q)) score += 120;
    else if (termLower.includes(q)) score += 85;

    // Full-form match
    if (fullLower === q) score += 150;
    else if (fullLower.includes(q)) score += 75;

    // Related words match
    if (relLower.includes(q)) score += 50;

    // Meaning & architecture match
    if (plainLower.includes(q)) score += 35;
    if (archLower.includes(q)) score += 30;
    if (exLower.includes(q)) score += 20;
    if (domainLower.includes(q)) score += 15;

    // Multi-token AND/OR scoring
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
