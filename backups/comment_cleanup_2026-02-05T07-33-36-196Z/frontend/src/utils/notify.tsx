import { createStandaloneToast, Box, Flex, Text } from '@chakra-ui/react';

const { toast } = createStandaloneToast();

type NotifyOpts = { duration?: number; position?: any; onClick?: (id?: string | number) => void; icon?: React.ReactNode; role?: string; ariaLive?: 'polite' | 'assertive'; topOffset?: number | string };

function renderToastContent(title: string, description?: string, bgProps?: any, opts?: NotifyOpts, id?: string | number) {
  return (
    <Box
      role={opts?.role || 'status'}
      aria-live={opts?.ariaLive || 'polite'}
      px={4}
      py={3}
      mt={opts?.topOffset ?? 14}
      borderRadius="12px"
      {...bgProps}
      color="white"
      boxShadow="lg"
      minW="260px"
      cursor={opts?.onClick ? 'pointer' : 'default'}
      onClick={opts?.onClick ? () => opts.onClick?.(id) : undefined}
    >
      <Flex gap={3} align="center">
        {opts?.icon && <Box mr={2}>{opts.icon}</Box>}
        <Box>
          <Text fontWeight={700}>{title}</Text>
          {description && <Text fontSize="sm" opacity={0.95}>{description}</Text>}
        </Box>
      </Flex>
    </Box>
  );
}

export const notify = {
  success: (title: string, description?: string, opts?: NotifyOpts) => {
    const id = toast({
      position: opts?.position || 'top-right',
      duration: opts?.duration ?? 4500,
      render: (props) => renderToastContent(title, description, { bgGradient: 'linear(to-r,#10b981,#047857)' }, opts, props?.id),
    });
    return id;
  },
  error: (title: string, description?: string, opts?: NotifyOpts) => {
    const id = toast({
      position: opts?.position || 'top-right',
      duration: opts?.duration ?? 5000,
      render: (props) => renderToastContent(title, description, { bgGradient: 'linear(to-r,#ff5f6d,#d7263d)' }, { ...opts, role: opts?.role ?? 'alert', ariaLive: opts?.ariaLive ?? 'assertive' }, props?.id),
    });
    return id;
  },
  info: (title: string, description?: string, opts?: NotifyOpts) => {
    const id = toast({
      position: opts?.position || 'top-right',
      duration: opts?.duration ?? 4000,
      render: (props) => renderToastContent(title, description, { bg: '#0ea5e9' }, opts, props?.id),
    });
    return id;
  },
  warn: (title: string, description?: string, opts?: NotifyOpts) => {
    const id = toast({
      position: opts?.position || 'top-right',
      duration: opts?.duration ?? 5000,
      render: (props) => renderToastContent(title, description, { bgGradient: 'linear(to-r,#f59e0b,#b45309)' }, { ...opts, role: opts?.role ?? 'status', ariaLive: opts?.ariaLive ?? 'polite' }, props?.id),
    });
    return id;
  },
  close: (id?: string | number) => {
    try {
      // @ts-ignore
      toast.close(id)
    } catch (e) {
      // ignore
    }
  }
};
