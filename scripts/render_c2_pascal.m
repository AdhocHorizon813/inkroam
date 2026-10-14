function render_c2_pascal(sourcePath)
% Reproduce a supplied trusted C2 script and export its three figures.
% Usage: addpath('scripts'); render_c2_pascal('absolute/path/yanghuitri.m')
% The supplied script runs clear, so compute export paths after it returns.
set(groot, 'defaultFigureVisible', 'off');
visibilityCleanup = onCleanup(@() set(groot, 'defaultFigureVisible', 'on'));
% Execute in a separate workspace so its clear cannot remove cleanup guards.
[A, B, C, n] = execute_source(sourcePath);
assert(isequal(size(A), [20 20]));
assert(isequal(A, tril(A)));
assert(all(diag(A) == 1));
assert(all(sum(A, 2) == 2.^(0:19)'));
assert(all(isfinite(C), 'all') && all(isfinite(B), 'all'));
assert(numel(findall(groot, 'Type', 'figure')) == 3);
outdir = fullfile(fileparts(fileparts(mfilename('fullpath'))), 'public', 'images', 'notes', 'c2-matlab');
if ~isfolder(outdir), mkdir(outdir); end
names = {'pascal-surface', 'pascal-log-surface', 'pascal-inverse-contour'};
titles = {'Pascal triangle A, n = 20', 'Natural logarithm (zero entries displayed as 0)', 'Element-wise absolute inverse of A + transpose(A)'};
for k = 1:3
    f = figure(k);
    set(f, 'Color', 'white', 'Position', [100 100 960 640]);
    ax = findobj(f, 'Type', 'axes');
    set(ax, 'Color', 'white', 'XColor', [.15 .15 .15], 'YColor', [.15 .15 .15], 'ZColor', [.15 .15 .15], 'FontSize', 12);
    title(ax, titles{k}, 'Color', [.1 .1 .1]);
    xlabel(ax, 'Column j'); ylabel(ax, 'Row i');
    if k == 1, zlabel(ax, 'A(i,j)'); end
    if k == 2, zlabel(ax, 'C(i,j)'); end
    colormap(ax, parula(256));
    cb = colorbar(ax); cb.Color = [.15 .15 .15];
    exportgraphics(f, fullfile(outdir, [names{k} '.png']), 'Resolution', 140);
end
fprintf('MATLAB %s\n', version);
fprintf('max(A) = %.15g\n', max(A, [], 'all'));
fprintf('max(C) = %.15g\n', max(C, [], 'all'));
fprintf('zero entries = %d\n', nnz(A == 0));
fprintf('rcond(A+A'') = %.15g\n', rcond(A+A'));
fprintf('inverse residual infinity norm = %.15g\n', norm((A+A')*B-eye(n), inf));
fprintf('max(abs(B)) = %.15g\n', max(abs(B), [], 'all'));
disp('pascal(5,1):'); disp(pascal(5,1));
disp('All assertions passed; exported 3 figures.');
close all;
end

function [A, B, C, n] = execute_source(sourcePath)
run(sourcePath);
end
