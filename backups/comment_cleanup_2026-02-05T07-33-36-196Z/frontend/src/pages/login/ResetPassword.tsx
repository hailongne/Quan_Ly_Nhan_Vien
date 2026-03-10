import React, { useState } from 'react';
import { Box, Button, Input, VStack, Text, HStack, InputGroup, InputRightElement, IconButton, Avatar, Divider, useColorModeValue, VStack as CkVStack } from '@chakra-ui/react';
import { ViewIcon, ViewOffIcon, CheckIcon, CloseIcon } from '@chakra-ui/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { notify } from '../../utils/notify';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';

export default function ResetPassword() {
  const { user, signout } = useAuth();
  const displayName = (user as any)?.name || (user as any)?.username || '';
  const userEmail = (user as any)?.email || displayName || '';
  const avatarSrc = (() => {
    const u = (user as any) || {};
    if (!u) return undefined;
    // common possible locations for avatar URL
    if (typeof u.avatar === 'string' && u.avatar) return u.avatar;
    if (u.avatar && typeof u.avatar === 'object') return u.avatar.url || u.avatar.path || u.avatar.src;
    if (u.avatarUrl) return u.avatarUrl;
    if (u.avatar_url) return u.avatar_url;
    if (u.profile && (u.profile.avatar || u.profile.avatarUrl || u.profile.avatar_url)) {
      return u.profile.avatar || u.profile.avatarUrl || u.profile.avatar_url;
    }
    return undefined;
  })();
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const strongEnough = (pwd: string) => /[a-z]/.test(pwd) && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd) && /[^a-zA-Z0-9]/.test(pwd) && pwd.length >= 8;
  const hasLower = (pwd: string) => /[a-z]/.test(pwd);
  const hasUpper = (pwd: string) => /[A-Z]/.test(pwd);
  const hasDigit = (pwd: string) => /[0-9]/.test(pwd);
  const hasSpecial = (pwd: string) => /[^a-zA-Z0-9]/.test(pwd);
  const hasLength = (pwd: string) => (pwd || '').length >= 8;
  const allGood = (pwd: string) => hasLower(pwd) && hasUpper(pwd) && hasDigit(pwd) && hasSpecial(pwd) && hasLength(pwd);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return notify.error('Bạn chưa đăng nhập');
    if (!strongEnough(newPwd)) return notify.error('Mật khẩu chưa đủ mạnh', 'Cần >=8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt');
    if (newPwd !== confirm) return notify.error('Không khớp', 'Mật khẩu xác nhận không khớp');
    if (!currentPwd) return notify.error('Thiếu mật khẩu hiện tại', 'Vui lòng nhập mật khẩu hiện tại để xác nhận');
    setLoading(true);
    try {
      await api.post('/api/auth/change-password', { currentPassword: currentPwd, newPassword: newPwd });
      notify.success('Thành công', 'Mật khẩu đã được cập nhật. Vui lòng đăng nhập lại.');
      signout();
      navigate('/login', { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể cập nhật mật khẩu';
      notify.error('Lỗi', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout
      roleLabel="Nhân viên"
      userName={displayName}
      onSignOut={() => { signout(); navigate('/login', { replace: true }); }}
      activeMenuKey="password"
    >
      <Box p={6} display="flex" justifyContent="center">
        <Box bg={useColorModeValue('white', 'blue.800')} p={8} borderRadius="16px" boxShadow="lg" w={{ base: 'full', md: '720px' }} maxW="920px" mx="auto" borderWidth="1px" borderColor={useColorModeValue('blue.100','blue.700')}>
          <HStack spacing={4} mb={4} align="center">
            <Avatar name={displayName || userEmail} size="lg" src={avatarSrc} />
            <CkVStack align="start" spacing={0}>
              <Text fontSize="lg" fontWeight={700}>Đổi mật khẩu</Text>
              <Text fontSize="sm" color="blue.500">{userEmail}</Text>
            </CkVStack>
          </HStack>
          <Divider mb={4} />
          <form onSubmit={handleSubmit}>
            <VStack spacing={4} align="stretch">
              <InputGroup>
                <Input value={currentPwd} onChange={(e)=>setCurrentPwd(e.target.value)} placeholder="Mật khẩu hiện tại" type={showCurrent ? 'text' : 'password'} size="md" borderRadius="md" />
                <InputRightElement>
                  <IconButton aria-label={showCurrent ? 'Ẩn mật khẩu hiện tại' : 'Hiện mật khẩu hiện tại'} icon={showCurrent ? <ViewOffIcon /> : <ViewIcon />} size="sm" variant="ghost" onClick={()=>setShowCurrent(s=>!s)} />
                </InputRightElement>
              </InputGroup>

              <InputGroup>
                <Input value={newPwd} onChange={(e)=>setNewPwd(e.target.value)} placeholder="Mật khẩu mới" type={showNew ? 'text' : 'password'} size="md" borderRadius="md" />
                <InputRightElement>
                  <IconButton aria-label={showNew ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'} icon={showNew ? <ViewOffIcon /> : <ViewIcon />} size="sm" variant="ghost" onClick={()=>setShowNew(s=>!s)} />
                </InputRightElement>
              </InputGroup>

              <Box fontSize={13} color="blue.600" mt={1} mb={2} ml={5}>
                <VStack align="start" spacing={1}>
                  <HStack spacing={2}>
                    {hasLength(newPwd) ? <CheckIcon color="green.500" boxSize={4} /> : <CloseIcon color="blue.300" boxSize={4} />}
                    <Text fontSize="12px" color={hasLength(newPwd) ? 'green.500' : 'blue.500'} fontWeight={hasLength(newPwd) ? 600 : 400}>Ít nhất 8 ký tự</Text>
                  </HStack>
                  <HStack spacing={2}>
                    {hasLower(newPwd) ? <CheckIcon color="green.500" boxSize={4} /> : <CloseIcon color="blue.300" boxSize={4} />}
                    <Text fontSize="12px" color={hasLower(newPwd) ? 'green.500' : 'blue.500'} fontWeight={hasLower(newPwd) ? 600 : 400}>Chữ thường (a-z)</Text>
                  </HStack>
                  <HStack spacing={2}>
                    {hasUpper(newPwd) ? <CheckIcon color="green.500" boxSize={4} /> : <CloseIcon color="blue.300" boxSize={4} />}
                    <Text fontSize="12px" color={hasUpper(newPwd) ? 'green.500' : 'blue.500'} fontWeight={hasUpper(newPwd) ? 600 : 400}>Chữ hoa (A-Z)</Text>
                  </HStack>
                  <HStack spacing={2}>
                    {hasDigit(newPwd) ? <CheckIcon color="green.500" boxSize={4} /> : <CloseIcon color="blue.300" boxSize={4} />}
                    <Text fontSize="12px" color={hasDigit(newPwd) ? 'green.500' : 'blue.500'} fontWeight={hasDigit(newPwd) ? 600 : 400}>Chứa số (0-9)</Text>
                  </HStack>
                  <HStack spacing={2}>
                    {hasSpecial(newPwd) ? <CheckIcon color="green.500" boxSize={4} /> : <CloseIcon color="blue.300" boxSize={4} />}
                    <Text fontSize="12px" color={hasSpecial(newPwd) ? 'green.500' : 'blue.500'} fontWeight={hasSpecial(newPwd) ? 600 : 400}>Ký tự đặc biệt</Text>
                  </HStack>
                </VStack>
              </Box>

              <InputGroup>
                <Input value={confirm} onChange={(e)=>setConfirm(e.target.value)} placeholder="Xác nhận mật khẩu mới" type={showConfirm ? 'text' : 'password'} size="md" borderRadius="md" />
                <InputRightElement>
                  <IconButton aria-label={showConfirm ? 'Ẩn xác nhận mật khẩu' : 'Hiện xác nhận mật khẩu'} icon={showConfirm ? <ViewOffIcon /> : <ViewIcon />} size="sm" variant="ghost" onClick={()=>setShowConfirm(s=>!s)} />
                </InputRightElement>
              </InputGroup>
              <HStack justify="flex-end" spacing={3}>
                <Button type="submit" colorScheme="blue" isLoading={loading} isDisabled={loading || !allGood(newPwd)} minW="180px">Cập nhật mật khẩu</Button>
              </HStack>
            </VStack>
          </form>
        </Box>
      </Box>
    </DashboardLayout>
  );
}
