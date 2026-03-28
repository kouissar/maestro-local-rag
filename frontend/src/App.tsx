import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  ThemeProvider, 
  CssBaseline, 
  Paper, 
  TextField, 
  Button, 
  List, 
  ListItem, 
  ListItemText, 
  IconButton, 
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Drawer,
  ListItemIcon
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import DescriptionIcon from '@mui/icons-material/Description';
import DeleteIcon from '@mui/icons-material/Delete';
import MenuIcon from '@mui/icons-material/Menu';
import HistoryIcon from '@mui/icons-material/History';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ForumIcon from '@mui/icons-material/Forum';
import axios from 'axios';
import theme from './theme';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

interface Performance {
  model: string;
  size: string;
  latency: string;
  chunks: number;
  tokens_in: number | string;
  tokens_out: number | string;
}

interface Source {
  source: string;
  content: string;
}

interface Message {
  text: string;
  sender: 'user' | 'bot';
  sources?: Source[];
  performance?: Performance;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('llama3.2:latest');
  const [documents, setDocuments] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [sessions, setSessions] = useState<string[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);

  useEffect(() => {
    fetchModels();
    fetchDocuments();
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/sessions`);
      setSessions(response.data.sessions);
    } catch (error) {
       console.error("Error fetching sessions:", error);
    }
  };

  const loadSession = async (sessionId: string) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/sessions/${sessionId}`);
      setMessages(response.data.messages);
      setCurrentSessionId(sessionId);
    } catch (error) {
      console.error("Error loading session:", error);
    } finally {
      setLoading(false);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
  };

  const handleDeleteSession = async (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!window.confirm("Delete this chat history?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/sessions/${sessionId}`);
      fetchSessions();
      if (currentSessionId === sessionId) {
        startNewChat();
      }
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  };

  const fetchModels = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/models`);
      setModels(response.data.models);
      if (response.data.models.length > 0 && !response.data.models.includes(selectedModel)) {
        setSelectedModel(response.data.models[0]);
      }
    } catch (error) {
      console.error("Error fetching models:", error);
    }
  };

  const fetchDocuments = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/documents`);
      setDocuments(response.data.documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = { text: input, sender: 'user' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/query/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: input,
          model: selectedModel,
          session_id: currentSessionId
        }),
      });

      if (!response.ok) throw new Error('Network response was not ok');
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      // Add an initial empty bot message
      const botMsg: Message = { text: '', sender: 'bot' };
      setMessages(prev => [...prev, botMsg]);

      let fullText = '';
      let sources: Source[] = [];
      let perf: Performance | undefined = undefined;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        
        // Handle multiple potential lines of metadata
        const lines = chunk.split('\n');
        for (const line of lines) {
           if (line.startsWith('SESSION_ID:')) {
             const sid = line.replace('SESSION_ID:', '');
             if (sid !== currentSessionId) {
               setCurrentSessionId(sid);
               fetchSessions();
             }
           } else if (line.startsWith('SOURCE_METADATA:')) {
             try {
               sources = JSON.parse(line.replace('SOURCE_METADATA:', ''));
             } catch (e) {
               console.error("Error parsing source metadata", e);
             }
           } else if (line.startsWith('PERFORMANCE_METRICS:')) {
             try {
               perf = JSON.parse(line.replace('PERFORMANCE_METRICS:', ''));
             } catch (e) {
               console.error("Error parsing performance metrics", e);
             }
           } else if (line) {
             // Avoid adding the actual control lines to fullText if they were on the same chunk
             if (!line.startsWith('SOURCE_METADATA:') && !line.startsWith('PERFORMANCE_METRICS:')) {
                fullText += line;
             }
           }
        }
        
        // Update the last message
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = { 
            ...newMessages[newMessages.length - 1], 
            text: fullText,
            sources: sources.length > 0 ? sources : newMessages[newMessages.length - 1].sources,
            performance: perf || newMessages[newMessages.length - 1].performance
          };
          return newMessages;
        });
      }
    } catch (error) {
      console.error("Error querying:", error);
      setMessages(prev => [...prev, { text: "Error fetching response. Is the backend running?", sender: 'bot' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
      if (!response.body) throw new Error('No progress stream');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(Boolean);
        
        for (const line of lines) {
          if (line.startsWith('Error:')) {
             throw new Error(line);
          }
          const p = parseInt(line);
          if (!isNaN(p)) {
            setUploadProgress(p);
          }
        }
      }

      setMessages(prev => [...prev, { text: `File "${file.name}" uploaded and processed.`, sender: 'bot' }]);
      fetchDocuments();
    } catch (error) {
      console.error("Error uploading:", error);
      alert("Upload failed.");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const handleClear = async () => {
    if (!window.confirm("Are you sure you want to clear the entire database?")) return;
    try {
      await axios.post(`${API_BASE_URL}/clear`);
      setMessages([]);
      setDocuments([]);
      alert("History and database cleared.");
    } catch (error) {
      console.error("Error clearing:", error);
    }
  };

  const handleDeleteDocument = async (filename: string) => {
    if (!window.confirm(`Delete "${filename}" from the database?`)) return;
    try {
      await axios.delete(`${API_BASE_URL}/documents/${filename}`);
      fetchDocuments();
    } catch (error) {
      console.error("Error deleting document:", error);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ 
        display: 'flex', 
        height: '100vh', 
        overflow: 'hidden', 
        bgcolor: 'background.default',
        color: 'text.primary',
        fontFamily: '"Outfit", sans-serif'
      }}>
        {/* Sidebar */}
        <Drawer
          variant="persistent"
          anchor="left"
          open={sidebarOpen}
          sx={{
            width: 320,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: 320,
              boxSizing: 'border-box',
              bgcolor: 'background.paper',
              borderRight: '1px solid rgba(255, 255, 255, 0.08)',
              p: 2,
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, px: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
              Maestro
            </Typography>
            <IconButton onClick={() => setSidebarOpen(false)} size="small" sx={{ opacity: 0.7 }}>
              <MenuIcon />
            </IconButton>
          </Box>
          
          <Box sx={{ mb: 4, px: 1 }}>
            <Button
              variant="contained"
              fullWidth
              startIcon={<AddIcon />}
              onClick={startNewChat}
              sx={{ py: 1.5, mb: 1.5, borderRadius: 2 }}
            >
              New Chat
            </Button>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                fullWidth
                component="label"
                disabled={uploading}
                startIcon={uploading ? <CircularProgress size={14} color="inherit" /> : <CloudUploadIcon />}
                size="small"
                sx={{ py: 1 }}
              >
                {uploading ? (uploadProgress !== null ? `${uploadProgress}%` : '...') : 'Upload'}
                <input type="file" hidden onChange={handleFileUpload} accept=".pdf,.txt,.md" />
              </Button>
              <Button
                variant="outlined"
                fullWidth
                color="error"
                size="small"
                startIcon={<DeleteSweepIcon />}
                onClick={handleClear}
                sx={{ py: 1, borderColor: 'rgba(211, 47, 47, 0.2)' }}
              >
                Clear
              </Button>
            </Box>
          </Box>

          {/* Chat History Section */}
          <Box 
            onClick={() => setHistoryOpen(!historyOpen)}
            sx={{ 
              px: 1, mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
              cursor: 'pointer', opacity: 0.8, '&:hover': { opacity: 1 } 
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <HistoryIcon sx={{ fontSize: 18 }} />
              <Typography variant="overline" sx={{ fontWeight: 700 }}>Chat History</Typography>
            </Box>
            {historyOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </Box>

          {historyOpen && (
            <List sx={{ flexGrow: 1, overflowY: 'auto', mb: 2, maxHeight: '40vh' }}>
              {sessions.length === 0 && (
                <Box sx={{ p: 2, textAlign: 'center', opacity: 0.4 }}>
                  <Typography variant="caption">No history yet</Typography>
                </Box>
              )}
              {sessions.map((sid) => (
                <ListItem
                  key={sid}
                  onClick={() => loadSession(sid)}
                  secondaryAction={
                    <IconButton edge="end" onClick={(e) => handleDeleteSession(sid, e)} size="small" 
                      sx={{ opacity: 0, '.MuiListItem-root:hover &': { opacity: 0.5 }, '&:hover': { opacity: '1 !important', color: 'error.main' } }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  }
                  sx={{ 
                    mb: 0.5, 
                    borderRadius: 1,
                    cursor: 'pointer',
                    bgcolor: currentSessionId === sid ? 'rgba(129, 140, 248, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                    borderColor: currentSessionId === sid ? 'primary.main' : 'transparent',
                    borderLeft: '3px solid',
                    '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <ForumIcon sx={{ fontSize: 16, color: currentSessionId === sid ? 'primary.main' : 'inherit', opacity: 0.7 }} />
                  </ListItemIcon>
                  <ListItemText 
                    primary={sid.includes('_') ? sid.replace(/_/g, ' ') : sid.replace(/(\d{2})-(\d{2})-(\d{2})$/, '$1:$2:$3')} 
                    primaryTypographyProps={{ 
                      variant: 'caption', 
                      noWrap: true,
                      fontWeight: currentSessionId === sid ? 700 : 500
                    }} 
                  />
                </ListItem>
              ))}
            </List>
          )}

          {/* Sources Section */}
          <Box 
            onClick={() => setSourcesOpen(!sourcesOpen)}
            sx={{ 
              px: 1, mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
              cursor: 'pointer', opacity: 0.8, '&:hover': { opacity: 1 } 
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DescriptionIcon sx={{ fontSize: 18 }} />
              <Typography variant="overline" sx={{ fontWeight: 700 }}>Source Documents</Typography>
            </Box>
            {sourcesOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </Box>

          {sourcesOpen && (
            <List sx={{ flexGrow: 0, overflowY: 'auto', maxHeight: '30vh' }}>
              {documents.length === 0 && (
                <Box sx={{ p: 2, textAlign: 'center', opacity: 0.4 }}>
                  <Typography variant="caption">No sources yet</Typography>
                </Box>
              )}
              {documents.map((doc) => (
                <ListItem
                  key={doc}
                  secondaryAction={
                    <IconButton edge="end" onClick={() => handleDeleteDocument(doc)} size="small" 
                      sx={{ opacity: 0, '.MuiListItem-root:hover &': { opacity: 0.5 }, '&:hover': { opacity: '1 !important', color: 'error.main' } }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  }
                  sx={{ 
                    mb: 0.5, 
                    bgcolor: 'rgba(255, 255, 255, 0.01)',
                    '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.03)' }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <DescriptionIcon fontSize="small" sx={{ fontSize: 16, color: 'primary.main', opacity: 0.6 }} />
                  </ListItemIcon>
                  <ListItemText 
                    primary={doc} 
                    primaryTypographyProps={{ 
                      variant: 'caption', 
                      noWrap: true
                    }} 
                  />
                </ListItem>
              ))}
            </List>
          )}
          
          <Box sx={{ mt: 'auto', pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <FormControl fullWidth size="small">
              <InputLabel id="model-select-label">Brain Engine</InputLabel>
              <Select
                labelId="model-select-label"
                value={selectedModel}
                label="Brain Engine"
                onChange={(e) => setSelectedModel(e.target.value)}
                sx={{ borderRadius: 2 }}
              >
                {models.map(model => (
                  <MenuItem key={model} value={model}>{model}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Drawer>

        {/* Main Content Area */}
        <Box 
          component="main" 
          sx={{ 
            flexGrow: 1, 
            display: 'flex', 
            flexDirection: 'column',
            position: 'relative',
            height: '100vh',
            transition: theme.transitions.create(['margin', 'width'], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
            ...(sidebarOpen && {
              ml: 0, // In flex, we don't need ML if it's dynamic
            }),
          }}
        >
          {/* Header */}
          <Box className="glass" sx={{ 
            p: 2, 
            px: 4, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            zIndex: 10,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {!sidebarOpen && (
                <IconButton onClick={() => setSidebarOpen(true)} size="small">
                  <MenuIcon />
                </IconButton>
              )}
              <Typography variant="h5" sx={{ fontWeight: 800, background: 'linear-gradient(90deg, #818cf8, #fb7185)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Maestro Local Knowledge Base
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ opacity: 0.6, fontWeight: 500 }}>
              {selectedModel}
            </Typography>
          </Box>

          {/* Chat Messages */}
          <Box sx={{ 
            flexGrow: 1, 
            overflowY: 'auto', 
            p: 4, 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 3,
            scrollBehavior: 'smooth',
            width: '100%',
            px: 6,
            pt: 4,
            pb: 12
          }}>
            {messages.length === 0 && (
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column',
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100%', 
                opacity: 0.5,
                textAlign: 'center'
              }}>
                <Box sx={{ 
                  width: 80, 
                  height: 80, 
                  borderRadius: '50%', 
                  bgcolor: 'rgba(129, 140, 248, 0.1)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  mb: 2
                }}>
                  <SendIcon sx={{ fontSize: 32, color: 'primary.main', opacity: 0.8 }} />
                </Box>
                <Typography variant="h6" sx={{ mb: 1 }}>How can I help today?</Typography>
                <Typography variant="body2">Upload sources to start a contextual conversation.</Typography>
              </Box>
            )}
            
            {messages.map((msg, index) => (
              <Box 
                key={index} 
                className="message-appear"
                sx={{ 
                  display: 'flex', 
                  justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  width: '100%'
                }}
              >
                <Paper 
                  elevation={0}
                  sx={{ 
                    p: 2.5, 
                    px: 3,
                    maxWidth: '85%', 
                    bgcolor: msg.sender === 'user' ? 'primary.main' : 'rgba(255, 255, 255, 0.03)',
                    color: msg.sender === 'user' ? 'white' : 'text.primary',
                    borderRadius: msg.sender === 'user' ? '24px 24px 4px 24px' : '24px 24px 24px 4px',
                    border: msg.sender === 'user' ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
                    boxShadow: msg.sender === 'user' ? '0 4px 20px rgba(99, 102, 241, 0.3)' : 'none',
                    lineHeight: 1.6
                  }}
                >
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                    {msg.text}
                  </Typography>
                  {msg.sources && msg.sources.length > 0 && (
                    <Box sx={{ mt: 2, pt: 1, borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <Box 
                        component="details" 
                        sx={{ 
                          '& summary': { 
                            cursor: 'pointer', 
                            listStyle: 'none', 
                            opacity: 0.4, 
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            letterSpacing: 0.5,
                            '&:hover': { opacity: 0.7 }
                          },
                          '& summary::-webkit-details-marker': { display: 'none' }
                        }}
                      >
                        <Box component="summary">CITATIONS ({msg.sources.length})</Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1.5 }}>
                          {msg.sources.map((s, i) => (
                            <Box key={i} sx={{ 
                              p: 1, 
                              bgcolor: 'rgba(255, 255, 255, 0.02)', 
                              borderRadius: 1,
                              borderLeft: '2px solid',
                              borderColor: 'primary.main',
                            }}>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', display: 'block' }}>
                                {s.source}
                              </Typography>
                              <Typography variant="caption" sx={{ opacity: 0.7, fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                "{s.content}"
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    </Box>
                  )}

                  {msg.performance && (
                    <Box sx={{ mt: 1, pt: 1 }}>
                      <Box 
                        component="details" 
                        sx={{ 
                          '& summary': { 
                            cursor: 'pointer', 
                            listStyle: 'none', 
                            opacity: 0.4, 
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            letterSpacing: 0.5,
                            '&:hover': { opacity: 0.7 }
                          },
                          '& summary::-webkit-details-marker': { display: 'none' }
                        }}
                      >
                        <Box component="summary">PERFORMANCE DETAILS</Box>
                        <Box sx={{ 
                          mt: 1, 
                          p: 1.5, 
                          bgcolor: 'rgba(0,0,0,0.15)', 
                          borderRadius: 1, 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(2, 1fr)',
                          gap: 1.5
                        }}>
                          <Box sx={{ gridColumn: 'span 2', borderBottom: '1px solid rgba(255,255,255,0.05)', pb: 0.5, mb: 0.5 }}>
                            <Typography variant="caption" sx={{ display: 'block', opacity: 0.5, fontSize: '0.6rem' }}>MODEL ENGINE</Typography>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main' }}>
                              {msg.performance.model} ({msg.performance.size})
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" sx={{ display: 'block', opacity: 0.5, fontSize: '0.6rem' }}>LATENCY</Typography>
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>{msg.performance.latency}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" sx={{ display: 'block', opacity: 0.5, fontSize: '0.6rem' }}>RETRIEVAL</Typography>
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>{msg.performance.chunks} chunks</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" sx={{ display: 'block', opacity: 0.5, fontSize: '0.6rem' }}>TOKENS IN</Typography>
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>{msg.performance.tokens_in}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" sx={{ display: 'block', opacity: 0.5, fontSize: '0.6rem' }}>TOKENS OUT</Typography>
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>{msg.performance.tokens_out}</Typography>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  )}
                </Paper>
              </Box>
            ))}
            
            {loading && (
              <Box sx={{ display: 'flex', gap: 1, p: 2, alignItems: 'center' }}>
                <CircularProgress size={16} thickness={5} />
                <Typography variant="caption" sx={{ opacity: 0.6, fontWeight: 600, letterSpacing: 1 }}>THINKING...</Typography>
              </Box>
            )}
          </Box>

          {/* Input Area */}
          <Box sx={{ 
            p: 4, 
            pt: 2,
            width: '100%',
          }}>
            <Paper 
              elevation={3}
              className="glass"
              sx={{ 
                p: 1, 
                px: 2,
                display: 'flex', 
                gap: 1.5,
                borderRadius: '20px',
                alignItems: 'center',
                boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
              }}
            >
              <TextField
                fullWidth
                multiline
                maxRows={4}
                variant="standard"
                placeholder="Message Maestro..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={loading}
                InputProps={{
                  disableUnderline: true,
                  sx: { py: 1, px: 1, fontSize: '1rem' }
                }}
              />
              <IconButton 
                color="primary" 
                onClick={handleSend}
                disabled={loading || !input.trim()}
                sx={{ 
                  bgcolor: 'primary.main', 
                  color: 'white',
                  '&:hover': { bgcolor: 'primary.dark' },
                  '&.Mui-disabled': { bgcolor: 'rgba(255, 255, 255, 0.05)', color: 'rgba(255, 255, 255, 0.1)' },
                  width: 44,
                  height: 44,
                  transition: 'all 0.2s'
                }}
              >
                <SendIcon fontSize="small" />
              </IconButton>
            </Paper>
            <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 1.5, opacity: 0.4 }}>
              Maestro can make mistakes. Check important info.
            </Typography>
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
