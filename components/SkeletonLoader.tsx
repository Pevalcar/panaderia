import { MotiView } from 'moti';
import { Skeleton } from 'moti/skeleton';

export default function SkeletonLoader({ 
  width = '100%', 
  height = 20, 
  radius = 4,
  colorMode = 'dark' 
}: { 
  width?: any, 
  height?: any, 
  radius?: any,
  colorMode?: 'light' | 'dark' 
}) {
  return (
    <MotiView
      transition={{
        type: 'timing',
      }}
      animate={{ backgroundColor: '#ffffff' }}
    >
      <Skeleton colorMode={colorMode} width={width} height={height} radius={radius} />
    </MotiView>
  );
}
