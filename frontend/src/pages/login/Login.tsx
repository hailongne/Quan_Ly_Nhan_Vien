import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Box,
  Button,
  FormControl,
  FormErrorMessage,
  Input,
  InputGroup,
  InputRightElement,
  IconButton,
  Image,
  Text,
  VStack,
  Flex,
  Grid,
  GridItem
} from '@chakra-ui/react';
import { notify } from '../../utils/notify';
import { ViewIcon, ViewOffIcon } from '@chakra-ui/icons';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [identifierError, setIdentifierError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  
  const navigate = useNavigate();
  const auth = useAuth();
  
  const firstRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIdentifierError('')
    setPasswordError('')

    const id = String(identifier || '').trim();
    const pwd = String(password || '');

    // Perform synchronous validation and store in locals
    let idErr = ''
    let pwdErr = ''

    if (!id) {
      idErr = 'Vui lòng nhập tên đăng nhập hoặc email'
    } else if (id.includes('@')) {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRe.test(id)) idErr = 'Email không hợp lệ'
    } else {
      const usernameRe = /^[a-zA-Z0-9_.-]{3,40}$/
      if (!usernameRe.test(id)) idErr = 'Tên đăng nhập không hợp lệ (3-40 ký tự)'
    }

    if (!pwd) pwdErr = 'Vui lòng nhập mật khẩu'
    else if (pwd.length < 6) pwdErr = 'Mật khẩu phải có ít nhất 6 ký tự'

    setIdentifierError(idErr)
    setPasswordError(pwdErr)
    if (idErr || pwdErr) return
    setLoading(true);
    try {
      const user = await auth.signin(identifier, password);
      notify.success('Đăng nhập thành công', 'Phiên đăng nhập sẽ tồn tại 24 giờ.');
      const role = user && typeof user === 'object' ? (user as Record<string, unknown>)['role'] as string | undefined : undefined;
      if (role === 'admin') navigate('/admin');
      else if (role === 'leader') navigate('/leader');
      else if (role === 'user') navigate('/user');
      else navigate('/');
    } catch (err: unknown) {
      let msg = 'Đăng nhập thất bại';
      try {
        type ErrShape = { response?: { data?: { message?: string } }; message?: string };
        const e = err as ErrShape;
        const backendMsg = e?.response?.data?.message || e?.message || '';
        const translate = (m?: string) => {
          if (!m) return 'Đăng nhập thất bại';
          const low = String(m).toLowerCase();
          if (low.includes('user not found') || (low.includes('not found') && low.includes('user'))) return 'Không tìm thấy người dùng';
          if (low.includes('invalid credentials') || low.includes('wrong password') || low.includes('password is incorrect') || low.includes('incorrect') || low.includes('invalid username') || low.includes('invalid username or password')) return 'Tên đăng nhập hoặc mật khẩu không đúng';
          if (low.includes('forbidden')) return 'Không có quyền thực hiện hành động này';
          if (low.includes('missing') || low.includes('required')) return 'Thiếu thông tin đăng nhập';
          return m;
        }
        msg = translate(backendMsg);
      } catch {
        /* ignore */
      }
      setError(msg);
      notify.error('Đăng nhập thất bại', msg);
    } finally {
      setLoading(false);
    }
  }

  // Desktop mock layout: white left, black divider, right column with avatar, two inputs with black outlines, blue button
  return (
    <Box minH="100vh" bg="white" display="flex" alignItems="stretch" justifyContent="center">
      <Grid templateColumns={{ base: '1fr', md: '7fr 3fr' }} w="full" maxW="full" minH="100vh">
        {/* Left: hero area matching mock (blue gradient, heading, text, CTA) */}
        <GridItem
          bgGradient="linear(to-br, #0b3d91, #3b82f6)"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <VStack align="start" maxW={{ base: 'full', md: '1000px' }} color="white">
            <Text fontSize={{ base: '3xl', md: '5xl' }} fontWeight={700} lineHeight={{ base: '40px', md: '64px' }}>
              Chào mừng bạn đến với nền tảng quản trị nhân sự FreeTrip!
            </Text>

            <Text fontSize={{ base: 'sm', md: 'md' }} opacity={0.9} maxW="800px">
              Tại đây, bạn có thể dễ dàng quản lý hồ sơ nhân viên, theo dõi chấm công và tính lương một cách chính xác. Hệ thống còn hỗ trợ toàn diện cho công tác tuyển dụng và đào tạo, đồng thời góp phần xây dựng một môi trường làm việc minh bạch và chuyên nghiệp.
            </Text>

            <Button
              variant="outline"
              borderColor="whiteAlpha.800"
              color="white"
              borderWidth={1}
              borderRadius="999px"
              px={6}
              py={4}
              _hover={{ bg: 'whiteAlpha.100' }}
            >
              👉 Bắt đầu ngay để tối ưu hóa công tác nhân sự trong doanh nghiệp của bạn!
            </Button>
          </VStack>
        </GridItem>

        {/* Right: form column with left black divider */}
        <GridItem
          bg="white"
          display="flex"
          alignItems="center"
          justifyContent="center"
          height={{ base: 'auto', md: '100vh' }}
          px={0}
        >
          <Flex direction="column" align="center" justify="center" w="full" height="100%">
            <Flex direction={{ base: 'column', md: 'row' }} align="center" justify="center" mb={4}>
              <Image src="/image/logofreetrip.png" alt="logo" boxSize={{ base: 24, md: 36 }} objectFit="contain" />
              <Text
                fontSize={{ base: '3xl', md: '7xl' }}
                fontWeight={700}
                lineHeight="150px"
                fontFamily="'Poppins', 'Segoe UI', Roboto, Arial, sans-serif"
              >
                <Text as="span" color="black">Free</Text>
                <Text as="span" color="#ff6a00" ml={1}>trip</Text>
              </Text>
            </Flex>

            <Text color="#006eff" mb={6} fontSize="sm">Đăng nhập để tiếp tục sử dụng tính năng</Text>

            <Flex w="full" justify="center" alignContent={'center'}>
                <Box justifyContent={'center'} maxW="800px" w="full" px={8} py={6}>
                  <form onSubmit={handleSubmit}>
                    <VStack spacing={4} align="stretch">
                      <FormControl isInvalid={Boolean(identifierError)}>
                        <InputGroup>
                          <Input
                            name="identifier"
                            id="identifier"
                            ref={firstRef}
                            value={identifier}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setIdentifier(e.target.value); setIdentifierError(''); setError('') }}
                            onBlur={() => {
                              const id = String(identifier || '').trim();
                              if (id && id.includes('@')) {
                                const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                                if (!emailRe.test(id)) setIdentifierError('Email không hợp lệ');
                              }
                            }}
                            placeholder="Tên đăng nhập hoặc email "
                            autoComplete="username"
                            bg="#eaf4ff"
                            border="1px solid #cfe5ff"
                            color="black"
                            _placeholder={{ color: 'blue.300' }}
                            borderRadius="12px"
                            h="48px"
                            px={4}
                            _focus={{ boxShadow: '0 0 0 2px rgba(0,110,255,0.15)', borderColor: '#006eff' }}
                          />
                        </InputGroup>
                        {identifierError ? <FormErrorMessage>{identifierError}</FormErrorMessage> : null}
                      </FormControl>

                      <FormControl isInvalid={Boolean(passwordError)}>
                        <InputGroup>
                          <Input
                            name="password"
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setPassword(e.target.value); setPasswordError(''); setError('') }}
                            placeholder="Nhập mật khẩu"
                            autoComplete="current-password"
                            bg="#eaf4ff"
                            border="1px solid #cfe5ff"
                            color="black"
                            _placeholder={{ color: 'blue.300' }}
                            borderRadius="12px"
                            h="48px"
                            px={4}
                            _focus={{ boxShadow: '0 0 0 2px rgba(0,110,255,0.15)', borderColor: '#006eff' }}
                          />
                          <InputRightElement h="full" pr={3}>
                            <IconButton
                              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                              icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                              size="sm"
                              color="#006eff"
                              variant="ghost"
                              onClick={() => setShowPassword(s => !s)}
                            />
                          </InputRightElement>
                        </InputGroup>
                        {passwordError ? <FormErrorMessage>{passwordError}</FormErrorMessage> : null}
                      </FormControl>

                      {error && <Text color="red.500" fontSize="sm">{error}</Text>}

                      <Flex align="center" justify="space-between">
                        <div />
                        <Text as="button" type="button" onClick={() => navigate('/forgot-password')} color="#006eff" fontSize="sm">
                          Quên mật khẩu?
                        </Text>
                      </Flex>

                      <Button
                        type="submit"
                        bgGradient="linear(to-r,#0077ff,#0047b3)"
                        color="white"
                        w="full"
                        h="48px"
                        borderRadius="10px"
                        boxShadow="sm"
                        _hover={{ opacity: 0.95 }}
                        _active={{ transform: 'translateY(1px)' }}
                        disabled={loading}
                      >
                        {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                      </Button>
                    </VStack>
                  </form>
                </Box>
            </Flex>
          </Flex>
        </GridItem>
      </Grid>
    </Box>
  );
}
